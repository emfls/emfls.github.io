document.addEventListener("DOMContentLoaded", () => {
    // Smooth scrolling for navigation links
    document.querySelectorAll("nav a").forEach((anchor) => {
        anchor.addEventListener("click", function (e) {
            e.preventDefault();

            const targetId = this.getAttribute("href");
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Determine if sidebar is sticky/fixed based on screen width
                const isMobileView = window.innerWidth <= 960; // Match CSS media query breakpoint
                let offsetPosition = targetElement.offsetTop;

                // Adjust for sticky elements if they exist at the top and cover content
                // In this layout, sidebar is sticky on desktop, not affecting scroll position.
                // If a fixed top header was ever added, its height would be needed here.
                // Currently, the header is not sticky, so no adjustment needed beyond targetElement.offsetTop.

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });

                // Update URL hash without jumping
                history.pushState(null, "", targetId);
            }
        });
    });

    // Handle hash on page load for direct links
    if (window.location.hash) {
        const targetId = window.location.hash;
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            // Same logic as above for initial load
            const isMobileView = window.innerWidth <= 960;
            let offsetPosition = targetElement.offsetTop;

            setTimeout(() => {
                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }, 100); // Small delay to ensure all elements are rendered
        }
    }

    // Tax Impact Simulator Functionality
    window.calculateNetIncome = function () {
        const grossIncomeInput = document.getElementById("grossIncome");
        const taxRateChangeInput = document.getElementById("taxRateChange");
        const estimatedNetIncomeSpan = document.getElementById("estimatedNetIncome");

        const grossIncome = parseFloat(grossIncomeInput.value);
        const taxRateChange = parseFloat(taxRateChangeInput.value);

        if (isNaN(grossIncome) || isNaN(taxRateChange)) {
            estimatedNetIncomeSpan.textContent = "유효한 숫자를 입력하십시오.";
            return;
        }

        // Calculate the change in tax amount based on the percentage
        // If taxRateChange is -2, it means a 2% *reduction* in tax, effectively increasing net income.
        // If taxRateChange is +3, it means a 3% *increase* in tax, effectively decreasing net income.
        // We assume taxRateChange directly affects the *final* net income percentage for simplicity in this simulator.
        // A more complex model would consider tax brackets, deductions, etc.
        const effectiveChangeMultiplier = (100 - taxRateChange) / 100;
        const estimatedNetIncome = grossIncome * effectiveChangeMultiplier;

        estimatedNetIncomeSpan.textContent = estimatedNetIncome.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "원";
    };

    // Initial calculation when page loads with default values
    calculateNetIncome();
});
