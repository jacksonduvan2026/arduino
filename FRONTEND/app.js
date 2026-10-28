document.addEventListener("DOMContentLoaded", () => {
    // State Application
    const state = {
        currentTab: "tab-dashboard",
        inventario: { page: 1, limit: 20, q: "", categoria: "TODAS", sortBy: "codigo", order: "asc" },
        ventas: { page: 1, limit: 20, q: "", empresa: "TODAS", ciudad: "TODAS", sortBy: "fecha", order: "desc" },
        productosIncluir: { q: "", categoria: "TODAS" },
        cronograma: { semana: "", q: "", estado: "TODOS" },
        charts: {}
    };

    // Navigation Tabs
    const navButtons = document.querySelectorAll(".nav-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const pageTitle = document.getElementById("page-title");

    const tabTitles = {
        "tab-dashboard": "Dashboard Principal",
        "tab-inventario": "Módulo de Inventario Cíclico",
        "tab-ventas": "Histórico de Ventas (DATA VENTAS)",
        "tab-productos-incluir": "Productos a Incluir al Inventario",
        "tab-cronograma": "Cronograma de Inventario Cíclico",
        "tab-reportes": "Reportes y Análisis Analítico",
        "tab-arduino": "Arduino Rover (Control & Sensores IR)",
        "tab-configuracion": "Configuración del Sistema"
    };

    navButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const targetTab = btn.getAttribute("data-tab");

            navButtons.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));

            btn.classList.add("active");
            document.getElementById(targetTab).classList.add("active");
            pageTitle.innerText = tabTitles[targetTab] || "Sistema";

            state.currentTab = targetTab;
            loadTabContent(targetTab);
        });
    });

    document.getElementById("btn-refresh").addEventListener("click", () => {
        loadTabContent(state.currentTab);
    });

    function loadTabContent(tabId) {
        switch (tabId) {
            case "tab-dashboard": loadDashboard(); break;
            case "tab-inventario": loadInventario(); break;
            case "tab-ventas": loadVentas(); break;
            case "tab-productos-incluir": loadProductosIncluir(); break;
            case "tab-cronograma": loadCronograma(); break;
            case "tab-reportes": loadReportes(); break;
            case "tab-arduino": loadArduinoStatus(); break;
        }
    }

    // 1. DASHBOARD
    async function loadDashboard() {
        try {
            const res = await fetch("/api/dashboard");
            const data = await res.json();

            document.getElementById("kpi-ventas-count").innerText = data.kpis.total_ventas_registros.toLocaleString();
            document.getElementById("kpi-ventas-monto").innerText = `$${data.kpis.total_monto_ventas.toLocaleString()}`;
            document.getElementById("kpi-refs-count").innerText = data.kpis.total_referencias_distintas;
            document.getElementById("kpi-prod-incluir").innerText = data.kpis.total_productos_a_incluir;
            document.getElementById("kpi-cronograma-prog").innerText = `${data.kpis.cronograma_progreso_porcentaje}%`;

            // Render Charts
            renderChart("chart-ciudad", "bar", data.ventas_por_ciudad.map(x => x.ciudad), data.ventas_por_ciudad.map(x => x.total), "Ventas $");
            renderChart("chart-empresa", "pie", data.ventas_por_empresa.map(x => x.empresa), data.ventas_por_empresa.map(x => x.total), "Ventas $");

            // Recent sales
            const tbody = document.querySelector("#table-recent-sales tbody");
            tbody.innerHTML = data.ultimas_ventas.map(v => `
                <tr>
                    <td>${v.no_orden}</td>
                    <td>${v.fecha}</td>
                    <td><strong>${v.codigo_referencia}</strong></td>
                    <td>${v.descripcion}</td>
                    <td><span class="badge badge-secondary">${v.empresa}</span></td>
                    <td>${v.ciudad}</td>
                    <td>$${v.valor_total_ref.toLocaleString()}</td>
                </tr>
            `).join("");
        } catch (err) {
            console.error("Error al cargar dashboard:", err);
        }
    }

    // Chart Renderer Helper
    function renderChart(canvasId, type, labels, dataValues, labelName) {
        if (state.charts[canvasId]) {
            state.charts[canvasId].destroy();
        }
        const ctx = document.getElementById(canvasId).getContext("2d");
        state.charts[canvasId] = new Chart(ctx, {
            type: type,
            data: {
                labels: labels,
                datasets: [{
                    label: labelName,
                    data: dataValues,
                    backgroundColor: [
                        '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#06b6d4', '#ec4899'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#f8fafc' } } },
                scales: type === 'bar' ? {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
                } : {}
            }
        });
    }

    // 2. INVENTARIO
    async function loadInventario() {
        const { page, limit, q, categoria, sortBy, order } = state.inventario;
        const params = new URLSearchParams({ page, limit, q, categoria, sort_by: sortBy, order });

        try {
            const res = await fetch(`/api/inventario?${params}`);
            const data = await res.json();

            // Populate category select
            const catSelect = document.getElementById("inv-cat-filter");
            if (catSelect.options.length <= 1) {
                data.categorias_disponibles.forEach(c => {
                    catSelect.add(new Option(c, c));
                });
            }

            document.getElementById("inv-count-info").innerText = `Mostrando ${data.items.length} de ${data.total} referencias`;

            const tbody = document.querySelector("#table-inventario tbody");
            if (data.items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center">No se encontraron referencias.</td></tr>`;
            } else {
                tbody.innerHTML = data.items.map(p => `
                    <tr>
                        <td><strong>${p.codigo}</strong></td>
                        <td>${p.descripcion}</td>
                        <td><span class="badge badge-secondary">${p.categoria}</span></td>
                        <td><strong>${p.stock_actual}</strong> ${p.unidad_medida}</td>
                        <td>${p.ubicacion}</td>
                        <td>
                            <button class="btn btn-outline btn-sm edit-inv-btn" data-codigo="${p.codigo}" data-desc="${p.descripcion}" data-stock="${p.stock_actual}"><i class="fa-solid fa-pen-to-square"></i></button>
                        </td>
                    </tr>
                `).join("");
            }

            renderPagination("inv-pagination", data.page, data.total_pages, (newPage) => {
                state.inventario.page = newPage;
                loadInventario();
            });

        } catch (err) {
            console.error("Error al cargar inventario:", err);
        }
    }

    // Eventos Inventario
    document.getElementById("btn-inv-filter").addEventListener("click", () => {
        state.inventario.q = document.getElementById("inv-search").value;
        state.inventario.categoria = document.getElementById("inv-cat-filter").value;
        state.inventario.page = 1;
        loadInventario();
    });

    document.getElementById("btn-inv-reset").addEventListener("click", () => {
        document.getElementById("inv-search").value = "";
        document.getElementById("inv-cat-filter").value = "TODAS";
        state.inventario.q = "";
        state.inventario.categoria = "TODAS";
        state.inventario.page = 1;
        loadInventario();
    });

    document.getElementById("inv-limit-select").addEventListener("change", (e) => {
        state.inventario.limit = parseInt(e.target.value);
        state.inventario.page = 1;
        loadInventario();
    });

    document.getElementById("btn-inv-export").addEventListener("click", () => {
        window.location.href = `/api/inventario/export/csv?q=${state.inventario.q}&categoria=${state.inventario.categoria}`;
    });

    // 3. VENTAS
    async function loadVentas() {
        const { page, limit, q, empresa, ciudad, sortBy, order } = state.ventas;
        const params = new URLSearchParams({ page, limit, q, empresa, ciudad, sort_by: sortBy, order });

        try {
            const res = await fetch(`/api/ventas?${params}`);
            const data = await res.json();

            // Populate filters
            const empSelect = document.getElementById("ventas-empresa-filter");
            if (empSelect.options.length <= 1) {
                data.filtros_disponibles.empresas.forEach(e => empSelect.add(new Option(e, e)));
            }
            const ciuSelect = document.getElementById("ventas-ciudad-filter");
            if (ciuSelect.options.length <= 1) {
                data.filtros_disponibles.ciudades.forEach(c => ciuSelect.add(new Option(c, c)));
            }

            document.getElementById("ventas-count-info").innerText = `Mostrando ${data.items.length} de ${data.total} registros de venta`;

            const tbody = document.querySelector("#table-ventas tbody");
            tbody.innerHTML = data.items.map(v => `
                <tr>
                    <td><strong>${v.no_orden}</strong></td>
                    <td>${v.fecha}</td>
                    <td>${v.codigo_referencia}</td>
                    <td>${v.descripcion_referencia}</td>
                    <td>${v.cantidad}</td>
                    <td>$${v.valor_total_ref.toLocaleString()}</td>
                    <td><span class="badge badge-secondary">${v.empresa}</span></td>
                    <td>${v.ciudad}</td>
                    <td>
                        <button class="btn btn-outline btn-sm view-venta-btn" data-id="${v.id}"><i class="fa-solid fa-eye"></i></button>
                    </td>
                </tr>
            `).join("");

            // View sale detail event
            document.querySelectorAll(".view-venta-btn").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const id = btn.getAttribute("data-id");
                    const vres = await fetch(`/api/ventas/${id}`);
                    const vdetail = await vres.json();

                    document.getElementById("modal-venta-body").innerHTML = `
                        <p><strong>Orden No:</strong> ${vdetail.no_orden}</p>
                        <p><strong>Fecha:</strong> ${vdetail.fecha}</p>
                        <p><strong>Empresa:</strong> ${vdetail.empresa} | <strong>Ciudad:</strong> ${vdetail.ciudad}</p>
                        <p><strong>Valor Total Orden:</strong> $${vdetail.valor_total_orden.toLocaleString()} ${vdetail.moneda}</p>
                        <hr style="border-color: var(--border-color); margin: 10px 0;">
                        <h4>Referencias en esta misma orden:</h4>
                        <ul style="padding-left: 20px; font-size: 0.9rem;">
                            ${vdetail.items_de_orden.map(i => `<li>${i.codigo_referencia} - ${i.descripcion} (${i.cantidad} un. - $${i.valor_total_ref.toLocaleString()})</li>`).join("")}
                        </ul>
                    `;
                    document.getElementById("modal-venta-detail").classList.add("active");
                });
            });

            renderPagination("ventas-pagination", data.page, data.total_pages, (newPage) => {
                state.ventas.page = newPage;
                loadVentas();
            });

        } catch (err) {
            console.error("Error al cargar ventas:", err);
        }
    }

    // Eventos Ventas
    document.getElementById("btn-ventas-filter").addEventListener("click", () => {
        state.ventas.q = document.getElementById("ventas-search").value;
        state.ventas.empresa = document.getElementById("ventas-empresa-filter").value;
        state.ventas.ciudad = document.getElementById("ventas-ciudad-filter").value;
        state.ventas.page = 1;
        loadVentas();
    });

    document.getElementById("btn-ventas-reset").addEventListener("click", () => {
        document.getElementById("ventas-search").value = "";
        document.getElementById("ventas-empresa-filter").value = "TODAS";
        document.getElementById("ventas-ciudad-filter").value = "TODAS";
        state.ventas.q = "";
        state.ventas.empresa = "TODAS";
        state.ventas.ciudad = "TODAS";
        state.ventas.page = 1;
        loadVentas();
    });

    document.getElementById("btn-ventas-export").addEventListener("click", () => {
        window.location.href = `/api/ventas/export/csv?q=${state.ventas.q}&empresa=${state.ventas.empresa}&ciudad=${state.ventas.ciudad}`;
    });

    // 4. PRODUCTOS A INCLUIR
    async function loadProductosIncluir() {
        try {
            const res = await fetch("/api/productos-incluir");
            const data = await res.json();

            const tbody = document.querySelector("#table-productos-incluir tbody");
            tbody.innerHTML = data.items.map(p => `
                <tr>
                    <td><strong>${p.codigo}</strong></td>
                    <td>${p.descripcion}</td>
                    <td><span class="badge badge-secondary">${p.categoria}</span></td>
                    <td>${p.meses.enero ?? '-'}</td>
                    <td>${p.meses.febrero ?? '-'}</td>
                    <td>${p.meses.marzo ?? '-'}</td>
                    <td>${p.meses.abril ?? '-'}</td>
                    <td>${p.meses.mayo ?? '-'}</td>
                    <td>${p.meses.junio ?? '-'}</td>
                    <td>${p.meses.julio ?? '-'}</td>
                    <td>${p.meses.agosto ?? '-'}</td>
                    <td>${p.meses.septiembre ?? '-'}</td>
                    <td>${p.meses.octubre ?? '-'}</td>
                    <td>${p.meses.noviembre ?? '-'}</td>
                    <td>${p.meses.diciembre ?? '-'}</td>
                    <td><strong>${p.total_anual}</strong></td>
                    <td><button class="btn btn-outline btn-sm"><i class="fa-solid fa-pen"></i></button></td>
                </tr>
            `).join("");
        } catch (err) {
            console.error("Error al cargar productos a incluir:", err);
        }
    }

    document.getElementById("btn-pi-export").addEventListener("click", () => {
        window.location.href = "/api/productos-incluir/export/csv";
    });

    // 5. CRONOGRAMA CÍCLICO
    async function loadCronograma() {
        const { semana, q, estado } = state.cronograma;
        const params = new URLSearchParams({ semana, q, estado });

        try {
            const res = await fetch(`/api/cronograma?${params}`);
            const data = await res.json();

            // Populate semana select
            const semSelect = document.getElementById("crono-semana-select");
            if (semSelect.options.length <= 1) {
                for (let i = 1; i <= 49; i++) {
                    semSelect.add(new Option(`Semana ${i}`, i));
                }
            }

            document.getElementById("crono-prog-tot").innerText = data.kpis.total_programados.toLocaleString();
            document.getElementById("crono-comp-tot").innerText = data.kpis.total_completados.toLocaleString();
            document.getElementById("crono-pend-tot").innerText = data.kpis.total_pendientes.toLocaleString();

            const tbody = document.querySelector("#table-cronograma tbody");
            tbody.innerHTML = data.items.map(it => `
                <tr>
                    <td>Semana ${it.semana}</td>
                    <td><strong>${it.codigo_referencia}</strong></td>
                    <td>${it.descripcion}</td>
                    <td>${it.categoria}</td>
                    <td>Conteo #${it.numero_conteo}</td>
                    <td>
                        <span class="badge ${it.estado === 'COMPLETADO' ? 'badge-success' : 'badge-warning'}">
                            ${it.estado}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-primary btn-sm register-conteo-btn" data-id="${it.id}" data-ref="${it.codigo_referencia}" data-desc="${it.descripcion}">
                            <i class="fa-solid fa-clipboard-check"></i> Registrar Conteo
                        </button>
                    </td>
                </tr>
            `).join("");

            // Evento registrar conteo
            document.querySelectorAll(".register-conteo-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    document.getElementById("modal-conteo-item-id").value = btn.getAttribute("data-id");
                    document.getElementById("modal-conteo-ref").value = btn.getAttribute("data-ref");
                    document.getElementById("modal-conteo-desc").value = btn.getAttribute("data-desc");
                    document.getElementById("modal-conteo-cant").value = "";
                    document.getElementById("modal-conteo-obs").value = "";
                    document.getElementById("modal-conteo").classList.add("active");
                });
            });

        } catch (err) {
            console.error("Error al cargar cronograma:", err);
        }
    }

    document.getElementById("btn-crono-filter").addEventListener("click", () => {
        state.cronograma.semana = document.getElementById("crono-semana-select").value;
        state.cronograma.q = document.getElementById("crono-ref-search").value;
        loadCronograma();
    });

    document.getElementById("btn-crono-regenerar").addEventListener("click", async () => {
        if (confirm("¿Está seguro de regenerar el cronograma cíclico? Esto recalculará la distribución de las 600 referencias.")) {
            const res = await fetch("/api/cronograma/regenerar", { method: "POST" });
            if (res.ok) {
                alert("Cronograma cíclico regenerado con éxito.");
                loadCronograma();
            }
        }
    });

    document.getElementById("btn-crono-export").addEventListener("click", () => {
        window.location.href = "/api/cronograma/export/csv";
    });

    // Guardar Conteo
    document.getElementById("btn-save-conteo").addEventListener("click", async () => {
        const itemId = document.getElementById("modal-conteo-item-id").value;
        const cant = parseFloat(document.getElementById("modal-conteo-cant").value);
        const obs = document.getElementById("modal-conteo-obs").value;

        if (isNaN(cant)) {
            alert("Ingrese un valor numérico para la cantidad física.");
            return;
        }

        const res = await fetch("/api/cronograma/conteo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                cronograma_item_id: parseInt(itemId),
                cantidad_fisica: cant,
                observaciones: obs
            })
        });

        if (res.ok) {
            document.getElementById("modal-conteo").classList.remove("active");
            loadCronograma();
        }
    });

    // Modal Close buttons
    document.getElementById("btn-close-conteo").addEventListener("click", () => document.getElementById("modal-conteo").classList.remove("active"));
    document.getElementById("btn-cancel-conteo").addEventListener("click", () => document.getElementById("modal-conteo").classList.remove("active"));
    document.getElementById("btn-close-venta-detail").addEventListener("click", () => document.getElementById("modal-venta-detail").classList.remove("active"));

    // 6. REPORTES
    async function loadReportes() {
        try {
            const resVentas = await fetch("/api/reportes/ventas-periodo");
            const dataVentas = await resVentas.json();
            renderChart("chart-report-ventas", "line", dataVentas.datos.map(x => x.mes), dataVentas.datos.map(x => x.total_monto), "Monto Total ($)");

            const resCrono = await fetch("/api/reportes/cronograma-resumen");
            const dataCrono = await resCrono.json();
            renderChart("chart-report-crono", "bar", dataCrono.semanas.map(x => `Sem ${x.semana}`), dataCrono.semanas.map(x => x.total), "Programados");

            const resTop = await fetch("/api/reportes/top-referencias");
            const dataTop = await resTop.json();
            const tbody = document.querySelector("#table-report-top tbody");
            tbody.innerHTML = dataTop.top_referencias.map(r => `
                <tr>
                    <td><strong>${r.codigo}</strong></td>
                    <td>${r.descripcion}</td>
                    <td>${r.cantidad_vendida.toLocaleString()} unidades</td>
                    <td>$${r.monto_total.toLocaleString()}</td>
                </tr>
            `).join("");
        } catch (err) {
            console.error("Error al cargar reportes:", err);
        }
    }

    // 7. ARDUINO ROVER
    async function loadArduinoStatus() {
        try {
            const res = await fetch("/api/arduino/status");
            const data = await res.json();
            console.log("Status Arduino Rover:", data);
        } catch (err) {
            console.error("Error al consultar Arduino Rover:", err);
        }
    }

    // 8. CONFIGURACIÓN
    document.getElementById("btn-reimportar").addEventListener("click", async () => {
        if (confirm("¿Desea reimportar la base de datos desde el archivo Excel original?")) {
            const logDiv = document.getElementById("reimport-log");
            logDiv.innerHTML = "Importando archivo Excel...";
            const res = await fetch("/api/admin/reimportar", { method: "POST" });
            const data = await res.json();
            logDiv.innerHTML = `<span style="color: var(--success);"><i class="fa-solid fa-check"></i> Importación completada:</span><br><pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
    });

    // Pagination Helper
    function renderPagination(containerId, currentPage, totalPages, onPageClick) {
        const container = document.getElementById(containerId);
        container.innerHTML = "";

        if (totalPages <= 1) return;

        for (let i = 1; i <= Math.min(totalPages, 10); i++) {
            const btn = document.createElement("button");
            btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
            btn.innerText = i;
            btn.addEventListener("click", () => onPageClick(i));
            container.appendChild(btn);
        }
    }

    // Initial load
    loadDashboard();
});
