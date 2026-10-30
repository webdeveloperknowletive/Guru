// Dashboard Chart.js Integration & Dynamic Live Updates

let revenueChartInstance = null;
let orderStatusChartInstance = null;

function initDashboardCharts(chartLabels, chartValues, statusCounts) {
  // 1. Revenue Overview Area Chart
  const revenueCanvas = document.getElementById("revenueChart");
  if (revenueCanvas) {
    const ctx = revenueCanvas.getContext("2d");

    // Saffron gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, "rgba(230, 106, 31, 0.35)");
    gradient.addColorStop(1, "rgba(230, 106, 31, 0.0)");

    if (revenueChartInstance) {
      revenueChartInstance.destroy();
    }

    revenueChartInstance = new Chart(ctx, {
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
                return "₹ " + Number(context.raw).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

    if (orderStatusChartInstance) {
      orderStatusChartInstance.destroy();
    }

    orderStatusChartInstance = new Chart(ctxStatus, {
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

// Dynamic Timeframe Selector for Revenue Chart
async function onRevenueTimeframeChange(timeframe) {
  if (!revenueChartInstance) return;
  try {
    const res = await fetch(`/admin/dashboard/chart-data?type=revenue&timeframe=${encodeURIComponent(timeframe)}`);
    if (!res.ok) throw new Error("Failed to load revenue chart data");
    const data = await res.json();
    if (data.success && data.labels && data.values) {
      revenueChartInstance.data.labels = data.labels;
      revenueChartInstance.data.datasets[0].data = data.values;
      revenueChartInstance.update();
    }
  } catch (err) {
    console.error("Error updating revenue chart:", err);
  }
}

// Dynamic Timeframe Selector for Order Status Chart & Legend
async function onOrderStatusTimeframeChange(timeframe) {
  if (!orderStatusChartInstance) return;
  try {
    const res = await fetch(`/admin/dashboard/chart-data?type=status&timeframe=${encodeURIComponent(timeframe)}`);
    if (!res.ok) throw new Error("Failed to load order status data");
    const data = await res.json();
    if (data.success && data.counts) {
      const counts = data.counts;
      const percentages = data.percentages || {};
      const total = data.total || 0;

      orderStatusChartInstance.data.datasets[0].data = [
        counts.delivered || 0,
        counts.processing || 0,
        counts.shipped || 0,
        counts.cancelled || 0,
        counts.pending || 0,
      ];
      orderStatusChartInstance.update();

      const numEl = document.getElementById("donutCenterNumber");
      if (numEl) numEl.textContent = total;

      const delEl = document.getElementById("legendCountDelivered");
      if (delEl) delEl.textContent = `${counts.delivered || 0} (${percentages.delivered || 0}%)`;

      const procEl = document.getElementById("legendCountProcessing");
      if (procEl) procEl.textContent = `${counts.processing || 0} (${percentages.processing || 0}%)`;

      const shipEl = document.getElementById("legendCountShipped");
      if (shipEl) shipEl.textContent = `${counts.shipped || 0} (${percentages.shipped || 0}%)`;

      const cancEl = document.getElementById("legendCountCancelled");
      if (cancEl) cancEl.textContent = `${counts.cancelled || 0} (${percentages.cancelled || 0}%)`;

      const pendEl = document.getElementById("legendCountPending");
      if (pendEl) pendEl.textContent = `${counts.pending || 0} (${percentages.pending || 0}%)`;
    }
  } catch (err) {
    console.error("Error updating order status chart:", err);
  }
}

// Interactive Date Range Dropdown Toggle
function toggleDateRangeMenu() {
  const menu = document.getElementById("dateRangeDropdown");
  if (!menu) return;
  const isShown = menu.style.display === "block";
  menu.style.display = isShown ? "none" : "block";
}

document.addEventListener("click", (e) => {
  const btn = document.getElementById("dateRangePickerBtn");
  const menu = document.getElementById("dateRangeDropdown");
  if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
    menu.style.display = "none";
  }
});
