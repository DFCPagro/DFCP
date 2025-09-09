export type FieldType = "text" | "email" | "tel" | "file";

export interface RoleField {
  label: string;
  type: FieldType;
}

export interface Role {
  name: string;
  description: string;
  fields: RoleField[];
}

export const mockRoles: readonly Role[] = [
  {
    name: "deliverer",
    description: "Responsible for transporting shipments.",
    fields: [
      { label: "Full Name", type: "text" },
      { label: "Email", type: "email" },
      { label: "Phone", type: "tel" },
      { label: "License Number", type: "text" },
      { label: "Vehicle Type", type: "text" },
      { label: "Bank Account", type: "text" },
      { label: "Bank Name", type: "text" },
      { label: "Driver License Doc", type: "file" },
      { label: "Vehicle Registration", type: "file" },
    ],
  },
  {
    name: "picker",
    description: "Packages and labels containers before shipping.",
    fields: [
      { label: "Full Name", type: "text" },
      { label: "Email", type: "email" },
      { label: "Phone", type: "tel" },
      { label: "Years of Experience", type: "text" },
      { label: "Preferred Shift", type: "text" },
      { label: "Bank Account", type: "text" },
      { label: "Bank Name", type: "text" },
      { label: "Resume", type: "file" },
    ],
  },
  {
    name: "industrialDeliverer",
    description: "delivering goods from farms to logistic center",
    fields: [
      { label: "Full Name", type: "text" },
      { label: "Email", type: "email" },
      { label: "Phone", type: "tel" },
      { label: "Years of Experience", type: "text" },
      { label: "Previous Company", type: "text" },
      { label: "Bank Account", type: "text" },
      { label: "Bank Name", type: "text" },
      { label: "Resume", type: "file" },
    ],
  },
  {
    name: "farmer",
    description: "Supplies produce and quality reports.",
    fields: [
      { label: "Full Name", type: "text" },
      { label: "Email", type: "email" },
      { label: "Phone", type: "tel" },
      { label: "Farm Name", type: "text" },
      { label: "Experience", type: "text" },
      { label: "Bank Account", type: "text" },
      { label: "Bank Name", type: "text" },
      { label: "ID Document", type: "file" },
      { label: "Bank Statement", type: "file" },
    ],
  },
  {
    name: "sorting",
    description: "general worker in the logistics center , sorting employee.",
    fields: [
      { label: "Full Name", type: "text" },
      { label: "Email", type: "email" },
      { label: "Phone", type: "tel" },
    ],
  },
  {
    name: "warehouse-worker",
    description: "Operates heavy-duty vehicles and equipment.",
    fields: [
      { label: "Full Name", type: "text" },
      { label: "Email", type: "email" },
      { label: "Phone", type: "tel" },
    ],
  },
] as const;
