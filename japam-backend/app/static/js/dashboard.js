// Dashboard Chart.js Integration

function initDashboardCharts(chartLabels, chartValues, statusCounts) {
  // 1. Revenue Overview Area Chart
  const revenueCanvas = document.getElementById("revenueChart");
  if (revenueCanvas) {
    const ctx = revenueCanvas.getContext("2d");

    // Saffron gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, "rgba(230, 106, 31, 0.35)");
    gradient.addColorStop(1, "rgba(230, 106, 31, 0.0)");

    new Chart(ctx, {
      type: "line",
      data: {
        labels: chartLabels,
        datasets: [{
          label: "Revenue (₹)",
          data: chartValues,
          borderColor: "#e66a1f",
          backgroundColor: gradient,
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointBackgroundColor: "#e66a1f",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "#1f2937",
            titleFont: { family: "Plus Jakarta Sans", size: 12 },
            bodyFont: { family: "Plus Jakarta Sans", size: 13, weight: "bold" },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                return "₹ " + Number(context.raw).toLocaleString("en-IN");
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: { family: "Plus Jakarta Sans", size: 10 },
              color: "#8c8277",
              maxTicksLimit: 8,
            }
          },
          y: {
            grid: {
              color: "#f4eee6",
            },
            ticks: {
              font: { family: "Plus Jakarta Sans", size: 10 },
              color: "#8c8277",
              callback: function(value) {
                return "₹ " + Number(value).toLocaleString("en-IN");
              }
            }
          }
        }
      }
    });
  }

  // 2. Order Status Donut Chart
  const statusCanvas = document.getElementById("orderStatusChart");
  if (statusCanvas) {
    const ctxStatus = statusCanvas.getContext("2d");
    new Chart(ctxStatus, {
      type: "doughnut",
      data: {
        labels: ["Delivered", "Processing", "Shipped", "Cancelled", "Pending"],
        datasets: [{
          data: [
            statusCounts.delivered || 0,
            statusCounts.processing || 0,
            statusCounts.shipped || 0,
            statusCounts.cancelled || 0,
            statusCounts.pending || 0,
          ],
          backgroundColor: [
            "#10b981", // Delivered (Green)
            "#f59e0b", // Processing (Amber)
            "#3b82f6", // Shipped (Blue)
            "#ef4444", // Cancelled (Red)
            "#94a3b8", // Pending (Slate)
          ],
          borderWidth: 2,
          borderColor: "#ffffff",
          hoverOffset: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "75%",
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "#1f2937",
            padding: 10,
            cornerRadius: 8,
          }
        }
      }
    });
  }
}
