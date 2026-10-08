# Bank Performance Management System (Staff Pro Max)

A production-grade performance management system for bank personnel, featuring role-based dashboards, KPI tracking, and cross-platform (PC/Android) support.

## 🚀 Deployment Guide

### 1. Firebase Setup
- **Firestore**: Deploy the generated `firestore.rules`.
- **Authentication**: Enable Email/Password login in the Firebase Console.
- **Hosting**: Run `npm run build` and deploy the `dist/` folder to Firebase Hosting.
- **Functions**: Deploy the user management functions (required for custom claims and admin logic).

### 2. Supabase Storage
- Create two buckets: `profile-pictures` (Public) and `attachments` (Private).
- Apply the SQL policies found in `docs/supabase_setup.sql`.

### 3. PWA & Android
- The app is PWA-compliant. Users can install it directly from the browser on Android/iOS.
- For a native Android APK, use **Capacitor** to wrap the built web assets.

## 🔐 Security Features
- **Inactivity Timeout**: Automatic logout after 15 minutes of idle time.
- **Audit Logging**: Every administrative action is tracked in the `auditLogs` collection.
- **RBAC**: Access is strictly enforced at the database level using Firestore Security Rules.
- **Zero-Trust**: No client-side delegation of security; all queries are validated against the user's Firestore profile.

## 📊 Business Logic
- **KPI Rollups**: Progress is calculated as `(Achievement / Target) * 100`.
- **Hierarchical Targets**: District Directors set Branch targets; Branch Managers set Staff targets.
- **Deposit Mobilization**: Reports for this KPI must be linked to a customer mapped in the "Customer Mapping" module.

---
*Built for production bank environments.*
