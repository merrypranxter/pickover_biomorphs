# Species Taxonomy

## _base_insectoid
- **Function**: `z = z^z + c`
- **Signature c**: (0.5, 0.1)
- **Morphology**: Arthropod — segmented body plan, radial appendages, chitinous texture
- **Habitat**: Darkfield, transmitted light
- **Scale**: Macroscopic (1-5mm)

## _embryonic
- **Function**: `z = sin(z) + c`
- **Signature c**: (0.3, 0.4)
- **Morphology**: Blastula/gastrula — spherical, translucent, yolk-dense core
- **Habitat**: Phase contrast, saline medium
- **Scale**: Microscopic (50-200µm)

## _radiolarian
- **Function**: `z = z * sin(z) + c`
- **Signature c**: (0.2, 0.15)
- **Morphology**: Heliozoan — radial spines, silicate lattice, hexaradial symmetry
- **Habitat**: Oil immersion darkfield
- **Scale**: Microscopic (20-100µm)

---

## Hybrid Rules
Cross two species by interpolating their:
1. Function components (if compatible)
2. c values (linear or complex interpolation)
3. Iteration parameters (blend thresholds)
4. Stain palettes (overlay or multiply)

Example hybrid: _insectoid_embryonic = z^z + sin(z) + c, c = lerp((0.5, 0.1), (0.3, 0.4), 0.5)
