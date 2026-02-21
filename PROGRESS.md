# Progress

## Current status

**Module 1: Imunizacao (SI-PNI)** -- in progress (data prep running)

## Completed

### Etapa 1: Reestruturar diretorios
- [x] Rename `dashboards/` to `dashboard/`
- [x] Move `prepare-data.R` to `data-prep/prep_vigitel.R`
- [x] Update `_quarto.yml` and `_quarto-en.yml` refs
- [x] Update `.gitignore`

### Etapa 2: Arquivos de fundacao
- [x] `data-prep/_utils.R`
- [x] `data-prep/_viz_utils.R`
- [x] `data-prep/_run_all.R`
- [x] `dashboard/_metadata.yml`
- [x] `dashboard/_viz_utils.R`

### Etapa 3: prep_imunizacao.R
- [x] Script created at `data-prep/prep_imunizacao.R`
- [ ] First run completed successfully
- [ ] CSVs generated in `dashboard/data/imunizacao/`
- [ ] Validation passed (columns, file sizes, plausible values)

### Etapa 4: Dashboard hub pages
- [x] `dashboard/index.qmd` (PT) -- card grid with all modules
- [x] `dashboard/index.en.qmd` (EN)

### Etapa 5: Dashboard imunizacao pages
- [x] `dashboard/imunizacao.qmd` (PT) -- tabsets, crosstalk, plotly, reactable
- [x] `dashboard/imunizacao.en.qmd` (EN)

### Etapa 6: Verificacao
- [ ] CSVs validated after prep run
- [ ] Site rendered with `babelquarto::render_website(".")`
- [ ] Preview checked with `servr::httw("_site")`
- [ ] Spec checklist (section 12) passed

## Next steps

1. Review `prep_imunizacao.R` output -- check if column names from healthbR match expectations; adjust script if needed
2. Render site and verify imunizacao dashboard works end-to-end
3. Fix any issues found during rendering
4. Commit module 1
5. Begin module 2: Vigitel migration (move from old RDS architecture to new CSV long format)

## Architecture reference

```
data-prep/          # offline scripts (not in site)
  _utils.R          # shared helpers
  _viz_utils.R      # palettes, layout_padrao()
  _run_all.R        # master runner
  prep_imunizacao.R # SI-PNI data pipeline
  prep_vigitel.R    # Vigitel data pipeline (legacy, uses RDS)

dashboard/          # site pages
  _metadata.yml     # shared YAML
  _viz_utils.R      # viz utils for .qmd
  index.qmd         # hub page
  imunizacao.qmd    # module 1
  vigitel/           # module 2 (legacy architecture)
  data/
    imunizacao/      # CSVs: brasil.csv, uf.csv, municipal.csv
```

## Module roadmap

| # | Module | Source | Status |
|---|---|---|---|
| 1 | Imunizacao | SI-PNI | In progress |
| 2 | Vigitel | Vigitel | Existing (needs migration) |
| 3 | Mortalidade | SIM | Planned |
| 4 | Mortalidade Materno-Infantil | SIM+SINASC | Planned |
| 5 | Natalidade | SINASC | Planned |
| 6 | Morbidade Hospitalar | SIH | Planned |
| 7 | Doencas de Notificacao | SINAN | Planned |
| 8 | Saude Mental | SIM+SIH+SINAN+CNES | Planned |
| 9 | PNS | PNS/IBGE | Planned |
