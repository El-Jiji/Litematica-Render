export class BlockStateResolver {
  static resolve(blockStateData, props, seed = "") {
    if (blockStateData.variants) {
      return this.resolveVariants(blockStateData.variants, props, seed);
    } else if (blockStateData.multipart) {
      return this.resolveMultipart(blockStateData.multipart, props, seed);
    }
    return [];
  }

  static resolveVariants(variants, props, seed = "") {
    const keys = Object.keys(variants);
    if (keys.length === 0) return [];

    // 1. Try matching with provided properties
    for (const variantKey in variants) {
      if (variantKey !== "" && this.matchesVariant(variantKey, props)) {
        const result = variants[variantKey];
        return [this.pickWeighted(result, `${seed}|${variantKey}`)];
      }
    }

    // 2. Fallback to default variant ""
    if (variants[""]) {
      const result = variants[""];
      return [this.pickWeighted(result, `${seed}|default`)];
    }

    // 3. Last Resort: Pick the first available variant to avoid holes
    // This happens if the schematic props don't match any blockstate variant
    const firstKey = keys[0];
    const result = variants[firstKey];
    return [this.pickWeighted(result, `${seed}|${firstKey}`)];
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

  static resolveMultipart(multipart, props, seed = "") {
    const results = [];
    multipart.forEach((part, index) => {
      if (!part.when || this.matchesCondition(part.when, props)) {
        const apply = this.pickWeighted(part.apply, `${seed}|multipart|${index}`);
        results.push(apply);
      }
    });

    if (results.length === 0 && multipart.length > 0) {
      console.warn(`[BlockStateResolver] Multipart mismatch for props:`, props);
      // Fallback: Use the first part's apply to avoid a hole
      const firstApply = this.pickWeighted(multipart[0].apply, `${seed}|multipart|fallback`);
      results.push(firstApply);
    }

    return results;
  }

  static pickWeighted(entry, seed = "") {
    if (!Array.isArray(entry)) return entry;
    if (entry.length === 0) return null;

    const totalWeight = entry.reduce(
      (sum, variant) => sum + Math.max(1, Number(variant?.weight || 1)),
      0,
    );
    let cursor = this.hashToUnit(seed) * totalWeight;

    for (const variant of entry) {
      cursor -= Math.max(1, Number(variant?.weight || 1));
      if (cursor <= 0) return variant;
    }

    return entry[entry.length - 1];
  }

  static hashToUnit(value) {
    const input = String(value);
    let hash = 2166136261;

    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0) / 4294967296;
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
