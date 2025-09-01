import { documentSchema } from "./basic-schema";
import { textblockTypeInputRule } from "prosemirror-inputrules";

export { documentSchema };

export function headingRule(level: number) {
  return textblockTypeInputRule(new RegExp(`^(#{1,${level}})\\s$`), documentSchema.nodes.heading, () => ({ level }));
}
