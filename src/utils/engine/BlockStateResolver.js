export class BlockStateResolver {
  static resolve(blockStateData, props) {
    if (blockStateData.variants) {
      return this.resolveVariants(blockStateData.variants, props);
    } else if (blockStateData.multipart) {
      return this.resolveMultipart(blockStateData.multipart, props);
    }
    return [];
  }

  static resolveVariants(variants, props) {
    const keys = Object.keys(variants);
    if (keys.length === 0) return [];

    // 1. Try matching with provided properties
    for (const variantKey in variants) {
      if (variantKey !== "" && this.matchesVariant(variantKey, props)) {
        const result = variants[variantKey];
        return Array.isArray(result) ? [result[0]] : [result];
      }
    }

    // 2. Fallback to default variant ""
    if (variants[""]) {
      const result = variants[""];
      return Array.isArray(result) ? [result[0]] : [result];
    }

    // 3. Last Resort: Pick the first available variant to avoid holes
    // This happens if the schematic props don't match any blockstate variant
    const firstKey = keys[0];
    const result = variants[firstKey];
    return Array.isArray(result) ? [result[0]] : [result];
  }

  static matchesVariant(variantKey, props) {
    if (variantKey === "") return true;
    const requirements = variantKey.split(',');
    for (const req of requirements) {
      const [k, v] = req.split('=');
      // Coerce props[k] to string for comparison, as they might be booleans or numbers
      if (props[k] === undefined || String(props[k]) !== v) return false;
    }
    return true;
  }

  static resolveMultipart(multipart, props) {
    const results = [];
    for (const part of multipart) {
      if (!part.when || this.matchesCondition(part.when, props)) {
        const apply = Array.isArray(part.apply) ? part.apply[0] : part.apply;
        results.push(apply);
      }
    }

    if (results.length === 0 && multipart.length > 0) {
      console.warn(`[BlockStateResolver] Multipart mismatch for props:`, props);
      // Fallback: Use the first part's apply to avoid a hole
      const firstApply = Array.isArray(multipart[0].apply) ? multipart[0].apply[0] : multipart[0].apply;
      results.push(firstApply);
    }

    return results;
  }

  static matchesCondition(condition, props) {
    if (condition.OR) {
      return condition.OR.some(c => this.matchesCondition(c, props));
    }
    if (condition.AND) {
      return condition.AND.every(c => this.matchesCondition(c, props));
    }

    // Direct property matches
    for (const key in condition) {
      const values = condition[key].split('|');
      const propVal = props[key] !== undefined ? String(props[key]) : "false";
      if (!values.includes(propVal)) return false;
    }
    return true;
  }
}
