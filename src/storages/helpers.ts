import type { DeepMergeLeafURI } from "deepmerge-ts";
import { deepmergeCustom } from "deepmerge-ts";

export const customDeepmerge = deepmergeCustom<{
  DeepMergeArraysURI: DeepMergeLeafURI;
}>({
  mergeArrays: false,
});
