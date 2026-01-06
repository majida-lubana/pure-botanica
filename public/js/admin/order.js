
        class OrderManager {
            constructor() {
                this.searchInput = document.getElementById("searchInput");
                this.clearSearchBtn = document.getElementById("clearSearchBtn");

                this.init();
            }

            init() {
                if (this.clearSearchBtn) {
                    this.clearSearchBtn.addEventListener("click", this.clearSearch.bind(this));
                }

                if (this.searchInput) {
                    this.searchInput.addEventListener("input", this.handleSearch.bind(this));
                }
            }

            handleSearch() {
                const searchTerm = this.searchInput.value.toLowerCase();
                const orderRows = document.querySelectorAll('.table-row');

                orderRows.forEach(row => {
                    const orderText = row.textContent.toLowerCase();
                    if (orderText.includes(searchTerm)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            }

            clearSearch() {
                if (this.searchInput) {
                    this.searchInput.value = "";
                    window.location.href = "/admin/orders";
                }
            }
        }

        document.addEventListener("DOMContentLoaded", () => {
            new OrderManager();
        });
