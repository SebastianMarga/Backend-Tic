export interface SupplierCreateDTO {
  name: string;
  email: string;
  phone?: string;
}

export interface SupplierUpdateDTO {
  name?: string;
  email?: string;
  phone?: string;
}