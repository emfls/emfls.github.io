document.addEventListener('DOMContentLoaded', () => {
    // Smooth scrolling for navigation links
    document.querySelectorAll('nav a').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                const isMobileView = window.innerWidth <= 992; // Match CSS media query breakpoint
                let offsetPosition = targetElement.offsetTop;

                // Adjust for fixed header if it were covering content.
                // In this design, the header is not sticky, and sidebar handles sticky.
                // If a fixed top header was added *above* the container, its height would be needed.

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });

                // Update URL hash without jumping
                history.pushState(null, '', targetId);
            }
        });
    });

    // Handle hash on page load for direct links
    if (window.location.hash) {
        const targetId = window.location.hash;
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            const isMobileView = window.innerWidth <= 992;
            let offsetPosition = targetElement.offsetTop;

            setTimeout(() => {
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }, 100); // Small delay to ensure all elements are rendered
        }
    }
});