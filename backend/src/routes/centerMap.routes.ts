import { Router } from "express";
import {
  getMap,
  upsertLayout,
  getInventory,
  bulkUpsertInventory,
  patchBin,
  searchItems,
  getItemLocations,
} from "../controllers/centerMap.controller";

const r = Router();

// Layout + inventory (center-scoped)
r.get(   "/centers/:centerId/map/:name",                 getMap);
r.put(   "/centers/:centerId/map/:name",                 upsertLayout);

// Inventory-only endpoints
r.get(   "/centers/:centerId/map/:name/inventory",       getInventory);
r.put(   "/centers/:centerId/map/:name/inventory",       bulkUpsertInventory);
r.patch( "/centers/:centerId/map/:name/locations/:code", patchBin);

// Item helpers (optional)
r.get(   "/centers/:centerId/items/search",              searchItems);
r.get(   "/centers/:centerId/items/:itemId/locations",   getItemLocations);

export default r;
