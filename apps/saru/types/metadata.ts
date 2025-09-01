export interface DocumentMetadata {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  type?: string;
  version?: number;
  [key: string]: any; 
} 