document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('catalog-card-view');
    if (container) {
        container.innerHTML = `
            <div class="main-entry-card">
                <div style="border-bottom: 1px solid #000; margin-bottom: 10px; padding-bottom: 5px; font-weight: bold;">
                    MAIN ENTRY &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; CARD 1 / 1
                </div>
                <div>Library Research Journal. -- / edited by Anita Sharma. --</div>
                <div>Vol. 1, no. 1 (2026)-</div>
                <div>New Delhi : Academic Publishers, 2026-</div>
                <div>volumes : illustrations ; 25 cm.</div>
                <div>ISSN 2581-6742</div>
            </div>
        `;
    }
});
