import type { AddressParts } from "./auth";

export interface Branch {
  id: string;
  name: string;
  code: string;
  email: string;
  /** Never returned by the API; retained only for legacy form compatibility. */
  password?: string;
  manager: string;
  contactNumber: string;
  address: string;
  addressParts: AddressParts | null;
  totalProducts: number;
  totalStock: number;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt?: string;
}
