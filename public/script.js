document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('#material-buttons button');
    let selectedMaterial = 'ALL MATERIALS';

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => {
                b.style.background = '#fff';
                b.style.color = '#111';
            });
            btn.style.background = '#111';
            btn.style.color = '#fff';
            selectedMaterial = btn.getAttribute('data-material');
        });
    });

    const generateBtn = document.getElementById('generate-btn');
    const questionInput = document.getElementById('question-input');
    const cardView = document.getElementById('catalog-card-view');

    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            const text = questionInput ? questionInput.value : '';
            cardView.innerHTML = '<div style="padding: 8px; font-weight: bold; font-size: 12px;">Generating ruled catalogue card...</div>';

            try {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ material: selectedMaterial, text: text })
                });
                const data = await response.json();
                if (data.success) {
                    cardView.innerHTML = `
                        <div class="main-entry-card">
                            <div class="card-top-bar">
                                <span>MAIN ENTRY</span>
                                <span>CARD 1 / 1</span>
                            </div>
                            <div class="card-content-area">
                                <div class="vertical-ruling-1"></div>
                                <div class="vertical-ruling-2"></div>
                                <pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin: 0; line-height: 24px; position: relative; z-index: 2;">${data.result}</pre>
                            </div>
                        </div>
                    `;
                }
            } catch (err) {
                cardView.innerHTML = '<div style="color: red; font-size: 12px;">Error generating card. Please try again.</div>';
            }
        });
    }
});
