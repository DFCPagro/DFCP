# Express + MongoDB + TypeScript Organized Starter

Clean, scalable Express server using MongoDB (Mongoose), TypeScript, JWT auth (access + refresh rotation), cookie-based refresh, role-based auth, central error handling, request validation, and a domain-driven folder layout.

## Quick Start

```bash
npm install
cp .env.example .env   # edit values
npm run dev            # ts-node-dev (dev hot reload)
# Build & run
npm run build && npm start
```

### Endpoints

- `GET /health` — health check
- `POST /v1/auth/register` — register a new user (roles: consumer, farmer, driver, admin)
- `POST /v1/auth/login` — login with email + password
- `POST /v1/auth/refresh` — refresh access token via httpOnly cookie or body
- `POST /v1/auth/logout` — revoke refresh token + clear cookie

### Project Layout

```
src/
  app.ts
  server.ts
  config/
    db.ts
    logger.ts
  controllers/
    auth.controller.ts
  middlewares/
    auth.ts
    error.ts
    notFound.ts
  models/
    index.ts
    token.model.ts
    user.model.ts
    farmer.model.ts
    consumer.model.ts
    driver.model.ts
    admin.model.ts
    vehicle.model.ts
    shipmentRequest.model.ts
    deliveryForm.model.ts
    container.model.ts
    shipment.model.ts
    logisticsCenter.model.ts
    order.model.ts
  routes/
    index.ts
    auth.route.ts
  services/
    auth.service.ts
    token.service.ts
    user.service.ts
  utils/
    ApiError.ts
    catchAsync.ts
    constants.ts
    generateId.ts
    pick.ts
    toJSON.ts
    validate.ts
  validations/
    auth.validation.ts
```

MIT © 2025
