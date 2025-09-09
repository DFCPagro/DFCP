import mongoose, { Schema, Model, Document, Types } from "mongoose";
import toJSON from "../utils/toJSON";


const allStagesOrder = [
  { key: "at-farm", label: "At Farm" },
  { key: "ready-for-pickup", label: "Ready for Pickup" },
  { key: "in-transit", label: "In Transit" },
  { key: "arrived", label: "Arrived" },
  { key: "sorting", label: "Sorting" },
  { key: "warehouse", label: "Warehouse" },
];

const farmerStatus: { [key: string]: string } = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  problem: "Problem",
};




