# Getting liquidation prices from Collateral values

## Calls

The original collateral calculation is as follows:

`Collat(s,p,t) = P(t) ⋆ min(p, spot_shock ⋆ s) + max(p − spot_shock ⋆ s, 0)`

This can be reversed to find the liquidation price as follows:

```sh
if:
    Collat(s,p,t)
  ----------------- > P(t)
    spot_shock * s

  p = Collat(s,p,t) − [P(t) − 1] ⋆ (spot_shock ⋆ s)

else:
        Collat(s,p,t)
  p = -----------------
            P(t)
```

## Puts

The original collateral calculation is as follows:

`Collat(s,p,t) = P(t) ⋆ min(s, spot_shock ⋆ p) + max(s − spot_shock ⋆ p, 0)`

This can be reversed to find the liquidation price as follows:

```sh
if:
  s ⋆ P(t) > Collat(s,p,t)

         Collat(s,p,t) − s
  p = -----------------------
      [P(t) − 1] ⋆ spot_shock

else:
  p = 0 # Is this right or is it undefined?
```

Document created by (?), March 29, 2023.
