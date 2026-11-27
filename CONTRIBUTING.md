# FoodFleet Team Ownership & Manual GitHub Workflow

FoodFleet is structured for a team of **three human developers**.

> **Important Policy**: All Git and GitHub operations (commits, branch creation, pushes, pull requests, human code reviews, and merges) must be performed **manually by the human developers**. No AI tools or automated scripts may execute Git commits, branch operations, or pull requests.

---

## Team Ownership

### Developer 1 — Frontend & Customer Experience (`developer-1`)
- Public editorial landing page & global design system
- Navigation & responsive layout
- Customer registration, login, and password reset UI
- Restaurant discovery, filtering, restaurant detail & menu UI
- Shopping cart, checkout UI, and live customer order tracking UI
- Frontend Vitest suite & API integration

### Developer 2 — Backend, Authentication & RBAC (`developer-2`)
- Django & MySQL database integration
- Custom `User`, profiles, addresses, JWT authentication
- Role-based permission classes & object-level authorization
- Restaurant & menu management backend APIs
- Centralized `OrderService`, cart calculations, and order state machine
- Backend validation, upload security, and RBAC test cases

### Developer 3 — Delivery, Payments & Administration (`developer-3`)
- Delivery Partner dashboard, assignment workflow & OpenStreetMap integration
- Razorpay test / simulated payment verification & refund workflow
- Super Admin dashboard, user/restaurant moderation, delivery dispatch & audit logs
- Recharts analytics, persistent & WebSocket notifications (Django Channels)
- End-to-end integration testing

---

## Permanent Branch Structure

1. `main` — Production-ready releases only.
2. `develop` — Shared integration branch; all developer PRs target `develop`.
3. `developer-1` — Developer 1 working branch.
4. `developer-2` — Developer 2 working branch.
5. `developer-3` — Developer 3 working branch.

## Manual Developer Workflow

```bash
# Initial repository setup by maintainer
git checkout main
git checkout -b develop
git push -u origin develop

git checkout -b developer-1 && git push -u origin developer-1
git checkout develop && git checkout -b developer-2 && git push -u origin developer-2
git checkout develop && git checkout -b developer-3 && git push -u origin developer-3

# Daily developer flow (example for developer-1)
git checkout developer-1
git pull origin develop
# Implement, verify locally, then stage and commit manually:
git add .
git commit -m "feat: implement customer restaurant discovery"
git push origin developer-1
# Open Pull Request: developer-1 -> develop for human review & merge
```

Every PR targeting `develop` must include:
- Clear title and feature description
- List of changes implemented and related modules
- Local testing performed and screenshots for UI updates
- Known issues (if any)
