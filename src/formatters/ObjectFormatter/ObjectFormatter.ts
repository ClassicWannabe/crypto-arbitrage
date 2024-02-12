import YAML from "yaml";

import { Formatter } from "../types.js";

export class ObjectFormatter implements Formatter {
  format(object: Record<string, unknown> | Record<string, unknown>[]) {
    return { text: YAML.stringify(object) };
  }
}
