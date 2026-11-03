import "server-only";
import type { ServerBackendService } from "@/lib/backend/interfaces/server";
import type { DataResult, MutationResult } from "@/lib/models";

// The Supabase implementation. Not built yet: the schema comes next. Every call reports it plainly
// rather than pretending, so turning the stub off shows exactly what's missing.
const todo = <T>(name: string): Promise<DataResult<T>> =>
  Promise.resolve({ data: null, error: `${name} isn't connected to Supabase yet` });
const todoMutation = (name: string): Promise<MutationResult> =>
  Promise.resolve({ success: false, error: `${name} isn't connected to Supabase yet` });

export class RealServerService implements ServerBackendService {
  getTogether = () => todo<never>("getTogether");
  createTogether = () => todo<never>("createTogether");
  renameTogether = () => todoMutation("renameTogether");
  joinTogether = () => todo<never>("joinTogether");
  getShoppingItems = () => todo<never>("getShoppingItems");
  getItemCatalog = () => todo<never>("getItemCatalog");
  addShoppingItem = () => todo<never>("addShoppingItem");
  setShoppingItemDone = () => todoMutation("setShoppingItemDone");
  clearDoneShoppingItems = () => todoMutation("clearDoneShoppingItems");
  getChores = () => todo<never>("getChores");
  addChore = () => todo<never>("addChore");
  setChoreDone = () => todo<never>("setChoreDone");
  getEvents = () => todo<never>("getEvents");
  getPlaces = () => todo<never>("getPlaces");
  getPlace = () => todo<never>("getPlace");
  addPlace = () => todo<never>("addPlace");
  getWishes = () => todo<never>("getWishes");
  getGoals = () => todo<never>("getGoals");
  setWishClaimed = () => todoMutation("setWishClaimed");
}
