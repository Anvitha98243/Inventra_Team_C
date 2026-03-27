# ⚡ ElectroStock — Smart Electronics Inventory Management System

A full-stack inventory management system for the electronics domain with role-based access (Admin & Staff), real-time stock alerts, stock request workflow, audit logs, and PDF/Excel export.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- MongoDB running locally on port 27017

### Step 1 — Start Backend
```bash
cd backend
npm install
npm start
```
Backend runs on: http://localhost:5000

### Step 2 — Start Frontend (new terminal)
```bash
cd frontend
npm install
npm start
```
Frontend runs on: http://localhost:3000

---

## 📁 Project Structure

```
electronics-inventory/
├── backend/
│   ├── models/
│   │   ├── User.js          # User schema (admin/staff)
│   │   ├── Product.js       # Electronics product schema
│   │   ├── StockRequest.js  # Stock in/out requests
│   │   └── AuditLog.js      # Activity audit log
│   ├── routes/
│   │   ├── auth.js          # Register, login, search-admin
│   │   ├── products.js      # CRUD products
│   │   ├── requests.js      # Stock request workflow
│   │   ├── logs.js          # Audit & transaction logs
│   │   └── export.js        # Data export endpoints
│   ├── middleware/
│   │   └── auth.js          # JWT auth + role guards
│   ├── .env                 # Environment config
│   └── server.js            # Express app entry point
│
└── frontend/
    └── src/
        ├── pages/
        │   ├── Login.js
        │   ├── Register.js
        │   ├── admin/
        │   │   ├── Dashboard.js    # Stats, alerts, pending requests
        │   │   ├── Products.js     # Full CRUD + PDF/Excel export
        │   │   ├── Requests.js     # Approve/reject stock requests
        │   │   └── Logs.js         # Audit & transaction logs
        │   └── staff/
        │       ├── Dashboard.js    # Overview + recent requests
        │       ├── Products.js     # Search admin, browse & request
        │       └── Requests.js     # Track own requests
        ├── components/
        │   └── Layout.js           # Sidebar navigation
        ├── context/
        │   └── AuthContext.js      # Auth state + JWT
        └── utils/
            └── api.js              # Axios config with auth header

```

---

## 🔑 User Roles

### Admin
- View dashboard with stats, low-stock alerts, pending requests
- Add, edit, delete products
- Approve or reject staff stock requests (auto-updates product quantity)
- View full audit logs and transaction history
- Export products, transactions, and audit logs as PDF or Excel

### Staff
- Register and log in
- Search for an admin by username
- Browse the admin's product inventory
- Submit Stock-In or Stock-Out requests with reason
- Track own request status (pending/approved/rejected)

---

## 🌐 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login and get JWT |
| GET | /api/auth/me | Get current user |
| GET | /api/auth/search-admin?username= | Find admin by username |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/products | Admin's own products |
| GET | /api/products/alerts | Low-stock alert products |
| GET | /api/products/by-admin/:id | Products by admin (staff use) |
| POST | /api/products | Create product |
| PUT | /api/products/:id | Update product |
| DELETE | /api/products/:id | Delete product |

### Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/requests | Staff creates request |
| GET | /api/requests/my | Staff's own requests |
| GET | /api/requests/admin | Admin's incoming requests |
| PUT | /api/requests/:id/resolve | Admin approves/rejects |

### Logs & Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/logs | Audit logs |
| GET | /api/logs/transactions | Transaction logs |
| GET | /api/export/products | Export products data |
| GET | /api/export/transactions | Export transactions |
| GET | /api/export/audit | Export audit logs |

---

## ⚙️ Environment Variables (backend/.env)

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/electronics_inventory
JWT_SECRET=electronics_inventory_super_secret_key_2024
```

---

## 🔧 Tech Stack

**Backend:** Node.js, Express.js, MongoDB, Mongoose, JWT, bcryptjs

**Frontend:** React 18, React Router v6, Axios, jsPDF, jspdf-autotable, SheetJS (xlsx), react-hot-toast

---

## 💡 Features

- ✅ JWT-based authentication with role guards
- ✅ Admin & Staff role-based dashboards
- ✅ Full product CRUD with category, SKU, threshold, location
- ✅ Low-stock alerts when quantity < minThreshold
- ✅ Stock request workflow (create → approve/reject → auto stock update)
- ✅ Audit log for all actions
- ✅ Transaction log for stock movements
- ✅ Export to PDF and Excel (products, transactions, audit logs)
- ✅ Staff searches admin by username to browse their products
- ✅ Responsive sidebar navigation
