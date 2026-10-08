# Security Specification - Bank Performance Management System

## Data Invariants
1. **Identity Integrity**: `ownerId`, `staffId`, and `actorId` fields must always match `request.auth.uid`.
2. **Role Hierarchy**: 
   - `Super Admin`: Global read/write.
   - `District Director`: Read/Write targets for branches in their district. Read access to branches/staff in district.
   - `Branch Manager`: Read/Write staff targets. Review (Update) staff reports/plans in their branch.
   - `Branch Staff`: Write own plans/reports/mappedCustomers. Read own targets.
3. **Relational Consistency**: Sub-resources (Plans, Reports) must be validated against their parent scope (User's branch/district).
4. **Immutable Fields**: `createdAt`, `kpiId`, and `period` cannot be changed after creation.

## The "Dirty Dozen" (Test Payloads for Denial)
1. **Privilege Escalation**: A `Branch Staff` trying to create a new `District`.
2. **Cross-Branch Access**: A `Branch Manager` trying to approve a report for a staff member in a different branch.
3. **Identity Spoofing**: A user trying to create a report with a `staffId` that doesn't match their own UID.
4. **Target Tampering**: A `Branch Staff` trying to set their own performance `Target`.
5. **District Hijacking**: A `District Director` trying to view a branch belonging to a different district.
6. **Shadow Field Injection**: Adding an `isAdmin: true` field to a user profile update.
7. **Orphaned Report**: Creating a `Report` with a non-existent `kpiId`.
8. **Audit Log Bypass**: Trying to delete an `AuditLog` entry (Audit logs should be write-only).
9. **Status Shortcutting**: A staff member setting their own report status to `approved`.
10. **Resource Poisoning**: Sending a 1MB string as a `customerName` in `MappedCustomer`.
11. **Stale Target Update**: Changing the `period` of a target after it has been set.
12. **Unverified Auth**: Accessing the database without an authenticated Firebase session.

## Role Verification Pattern
Roles are verified by looking up the user document in `/users/$(request.auth.uid)`.
```javascript
function getUserData() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}
function hasRole(role) {
  return isSignedIn() && getUserData().role == role;
}
```
