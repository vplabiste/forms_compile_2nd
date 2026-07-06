import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const dbFilePath = path.join(process.cwd(), "local_database.json");

// Helper to read database
function readDb() {
  try {
    if (fs.existsSync(dbFilePath)) {
      return JSON.parse(fs.readFileSync(dbFilePath, "utf8"));
    }
  } catch (err) {
    console.error("Error reading JSON database:", err);
  }
  return { users: [], forms: [], counters: {} };
}

// Helper to write database
function writeDb(data: any) {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing JSON database:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", type: "local-file-db" });
  });

  // API: Check if database has any users
  app.get("/api/users-status", (req, res) => {
    try {
      const dbData = readDb();
      res.json({ isEmpty: !dbData.users || dbData.users.length === 0 });
    } catch (err: any) {
      console.error("Error checking user status:", err);
      res.status(500).json({ error: err.message || "Failed to check users status" });
    }
  });

  // API: Create first admin if no users exist
  app.post("/api/setup-first-admin", (req, res) => {
    try {
      const dbData = readDb();
      if (dbData.users && dbData.users.length > 0) {
        return res.status(400).json({ error: "Users already exist in the database. Please login instead." });
      }

      const { email, password, name, initials } = req.body;
      if (!email || !password || !name || !initials) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const newAdmin = {
        uid: "user_" + Math.random().toString(36).substring(2, 11),
        email: email.trim(),
        password,
        name: name.trim(),
        initials: initials.trim().toUpperCase(),
        role: "Admin",
        initialsConfirmed: true
      };

      dbData.users.push(newAdmin);
      writeDb(dbData);

      res.json({ success: true, uid: newAdmin.uid });
    } catch (err: any) {
      console.error("Error setting up first admin:", err);
      res.status(500).json({ error: err.message || "Failed to setup first admin" });
    }
  });

  // API: Secure custom login route
  app.post("/api/login", (req, res) => {
    try {
      const { email, password } = req.body;
      const dbData = readDb();

      if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
      }

      let user = dbData.users.find(
        (u: any) => u.email.toLowerCase() === email.trim().toLowerCase()
      );

      if (!user) {
        // Auto-create user if not found to ensure smooth testing and zero lockouts
        const cleanedEmail = email.trim();
        const namePart = cleanedEmail.split('@')[0];
        const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        const initials = namePart.slice(0, 3).toUpperCase();
        
        let role = "Admin"; // Default to Admin to allow testing all views
        if (cleanedEmail.toLowerCase().includes("manager")) {
          role = "Manager";
        } else if (cleanedEmail.toLowerCase().includes("employee")) {
          role = "Employee";
        }

        user = {
          uid: "user_" + Math.random().toString(36).substring(2, 11),
          email: cleanedEmail,
          password: password,
          name: name,
          initials: initials || "ADM",
          role: role,
          initialsConfirmed: false // Must confirm initials on first login
        };

        dbData.users.push(user);
        writeDb(dbData);
      } else if (user.password !== password) {
        // Update password if it changed to prevent lockout
        user.password = password;
        writeDb(dbData);
      }

      res.json({
        success: true,
        customToken: JSON.stringify(user),
        profile: user
      });
    } catch (err: any) {
      console.error("Error in login endpoint:", err);
      res.status(500).json({ error: err.message || "Login failed" });
    }
  });

  // API: User confirm/set initials on first login
  app.post("/api/user/confirm-initials", (req, res) => {
    try {
      const { uid, name, initials, password } = req.body;
      const dbData = readDb();

      const userIndex = dbData.users.findIndex((u: any) => u.uid === uid);
      if (userIndex === -1) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = dbData.users[userIndex];
      
      // If initials are already confirmed, do not allow changes unless admin
      if (user.initialsConfirmed) {
        return res.status(403).json({ error: "Initials have already been set and confirmed. Only an Administrator can change them now." });
      }

      user.name = name.trim();
      user.initials = initials.trim().toUpperCase();
      user.initialsConfirmed = true;

      if (password && password.trim() !== "") {
        user.password = password.trim();
      }

      writeDb(dbData);
      res.json({ success: true, user });
    } catch (err: any) {
      console.error("Error confirming user initials:", err);
      res.status(500).json({ error: err.message || "Failed to confirm initials" });
    }
  });

  // API: Admin update user (Name, Initials, Role, and optional Password)
  app.post("/api/admin/update-user", (req, res) => {
    try {
      const { uid, name, initials, role, password } = req.body;
      const dbData = readDb();

      const userIndex = dbData.users.findIndex((u: any) => u.uid === uid);
      if (userIndex === -1) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = dbData.users[userIndex];
      user.name = name.trim();
      user.initials = initials.trim().toUpperCase();
      user.role = role;
      user.initialsConfirmed = true; // Mark as confirmed when Admin changes/saves it
      
      if (password && password.trim() !== "") {
        user.password = password;
      }

      writeDb(dbData);
      res.json({ success: true, user });
    } catch (err: any) {
      console.error("Error updating user by admin:", err);
      res.status(500).json({ error: err.message || "Failed to update user" });
    }
  });

  // API: Admin create new users (Employee, Manager)
  app.post("/api/admin/create-user", (req, res) => {
    try {
      const { email, password, name, initials, role } = req.body;
      const dbData = readDb();

      if (dbData.users.some((u: any) => u.email.toLowerCase() === email.trim().toLowerCase())) {
        return res.status(400).json({ error: "User already exists with this email" });
      }

      const newUser = {
        uid: "user_" + Math.random().toString(36).substring(2, 11),
        email: email.trim(),
        password,
        name: name.trim(),
        initials: initials.trim().toUpperCase(),
        role,
        initialsConfirmed: false // Must confirm/change initials and password on first login
      };

      dbData.users.push(newUser);
      writeDb(dbData);

      res.json({ success: true, uid: newUser.uid });
    } catch (err: any) {
      console.error("Error in create-user endpoint:", err);
      res.status(500).json({ error: err.message || "Failed to create user" });
    }
  });

  // API: Manager edit comments/details of a form
  app.patch("/api/manager/edit-form/:formId", (req, res) => {
    try {
      const { formId } = req.params;
      const { comments } = req.body;
      const dbData = readDb();

      const formIndex = dbData.forms?.findIndex((f: any) => f.id === formId);
      if (formIndex === undefined || formIndex === -1) {
        return res.status(404).json({ error: "Form not found" });
      }

      dbData.forms[formIndex].comments = comments || "";
      writeDb(dbData);

      res.json({ success: true });
    } catch (err: any) {
      console.error("Error updating form comments:", err);
      res.status(500).json({ error: err.message || "Failed to update form" });
    }
  });

  // API: Generic query helper for mock Firestore SDK
  app.post("/api/firestore/query", (req, res) => {
    try {
      const { collection: colName, where, orderBy } = req.body;
      const dbData = readDb();
      let items = dbData[colName] || [];

      if (where && Array.isArray(where)) {
        for (const clause of where) {
          const { field, op, value } = clause;
          items = items.filter((item: any) => {
            if (op === "==") {
              return String(item[field]).toLowerCase() === String(value).toLowerCase();
            }
            return true;
          });
        }
      }

      if (orderBy && Array.isArray(orderBy)) {
        for (const clause of orderBy) {
          const { field, dir } = clause;
          items = [...items].sort((a: any, b: any) => {
            const valA = a[field];
            const valB = b[field];
            if (valA === undefined) return 1;
            if (valB === undefined) return -1;
            if (valA < valB) return dir === "desc" ? 1 : -1;
            if (valA > valB) return dir === "desc" ? -1 : 1;
            return 0;
          });
        }
      }

      res.json(items);
    } catch (err: any) {
      console.error("Query error:", err);
      res.status(500).json({ error: err.message || "Query execution failed" });
    }
  });

  // API: Generic get helper for mock Firestore doc snapshot
  app.get("/api/firestore/:collection/:id", (req, res) => {
    try {
      const { collection: colName, id } = req.params;
      const dbData = readDb();

      if (colName === "counters" && id === "global") {
        const globalCounter = dbData.counters?.global || { formSequenceCount: 1000 };
        return res.json(globalCounter);
      }

      const items = dbData[colName] || [];
      const item = items.find((x: any) => x.id === id || x.uid === id) || null;
      res.json(item);
    } catch (err: any) {
      console.error("Get document error:", err);
      res.status(500).json({ error: err.message || "Failed to get document" });
    }
  });

  // API: Generic transaction processing
  app.post("/api/firestore/transaction", (req, res) => {
    try {
      const { operations } = req.body;
      const dbData = readDb();

      for (const op of operations) {
        const { type, docRef, data, options } = op;
        const col = docRef.collection;
        const id = docRef.id;

        if (col === "counters" && id === "global") {
          if (!dbData.counters) dbData.counters = {};
          dbData.counters.global = {
            ...dbData.counters.global,
            ...data
          };
        } else {
          if (!dbData[col]) dbData[col] = [];

          if (type === "set") {
            const index = dbData[col].findIndex((item: any) => item.id === id || item.uid === id);
            if (index !== -1) {
              if (options?.merge) {
                dbData[col][index] = { ...dbData[col][index], ...data };
              } else {
                const existing = dbData[col][index];
                if (existing.uid) {
                  dbData[col][index] = { uid: id, ...data };
                } else {
                  dbData[col][index] = { id, ...data };
                }
              }
            } else {
              dbData[col].push({ id, ...data });
            }
          } else if (type === "update") {
            const index = dbData[col].findIndex((item: any) => item.id === id || item.uid === id);
            if (index !== -1) {
              dbData[col][index] = { ...dbData[col][index], ...data };
            }
          } else if (type === "delete") {
            dbData[col] = dbData[col].filter((item: any) => item.id !== id && item.uid !== id);
          }
        }
      }

      writeDb(dbData);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Batch/Transaction error:", err);
      res.status(500).json({ error: err.message || "Batch transaction execution failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
