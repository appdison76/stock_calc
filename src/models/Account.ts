import { Currency } from './Currency';

export interface Account {
  id: string;
  name: string;
  currency: Currency;
  createdAt: number;
  updatedAt: number;
}
