# =============================================================================
# _viz_utils.R
# funcoes auxiliares de visualizacao (paletas, layout padrao plotly)
# =============================================================================

# paleta padrao do dashboard
cores_dashboard <- list(
  primaria     = "#2563EB",
  secundaria   = "#64748B",
  sucesso      = "#16A34A",
  alerta       = "#EAB308",
  perigo       = "#DC2626",
  fundo        = "#F8FAFC",
  texto        = "#1E293B",
  gradiente    = c("#DBEAFE", "#3B82F6", "#1E3A8A")
)

# paleta para regioes brasileiras
cores_regioes <- c(
  "Norte"        = "#22C55E",
  "Nordeste"     = "#EAB308",
  "Sudeste"      = "#3B82F6",
  "Sul"          = "#8B5CF6",
  "Centro-Oeste" = "#F97316"
)

# paleta para sexo
cores_sexo <- c(
  "masculino" = "#3B82F6",
  "feminino"  = "#EC4899"
)

# paleta para raca/cor
cores_raca <- c(
  "branca"   = "#3B82F6",
  "preta"    = "#1E293B",
  "parda"    = "#F59E0B",
  "amarela"  = "#10B981",
  "indigena" = "#8B5CF6"
)

# tema base para plotly
layout_padrao <- function(p, titulo = NULL, eixo_x = NULL, eixo_y = NULL) {
  p |>
    plotly::layout(
      title = list(
        text = titulo,
        font = list(size = 16, color = "#1E293B")
      ),
      xaxis = list(
        title = eixo_x,
        gridcolor = "#E2E8F0",
        zerolinecolor = "#CBD5E1"
      ),
      yaxis = list(
        title = eixo_y,
        gridcolor = "#E2E8F0",
        zerolinecolor = "#CBD5E1"
      ),
      plot_bgcolor = "#FFFFFF",
      paper_bgcolor = "#F8FAFC",
      font = list(family = "system-ui, sans-serif", color = "#1E293B"),
      hoverlabel = list(
        bgcolor = "#1E293B",
        font = list(color = "#FFFFFF", size = 12)
      ),
      margin = list(t = 60, b = 60, l = 60, r = 40)
    )
}
