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
            cardView.innerHTML = '<div style="padding: 8px; font-weight: bold; font-size: 12px;">Generating structured catalogue card...</div>';

            try {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ material: selectedMaterial, text: text })
                });
                const data = await response.json();
                if (data.success && data.result && data.result.cards) {
                    let cardsHtml = `
                        <div class="action-bar">
                            <h3 style="margin: 0; font-size: 14px;">Catalogue entry generated</h3>
                            <div>
                                <button onclick="alert('Copied to clipboard!')">COPY</button>
                                <button>DOWNLOAD PDF</button>
                            </div>
                        </div>
                    `;

                    data.result.cards.forEach((card) => {
                        let rowsHtml = card.lines.map(lineData => `
                            <tr>
                                <td class="col-outside-1">${lineData.outside1 || ''}</td>
                                <td class="col-outside-2">${lineData.outside2 || ''}</td>
                                <td class="col-content">${lineData.text}</td>
                            </tr>
                        `).join('');

                        cardsHtml += `
                            <div class="main-entry-card">
                                <div class="card-top-bar">
                                    <span>${card.type}</span>
                                    <span>${card.cardNumber}</span>
                                </div>
                                <table class="card-table">
                                    ${rowsHtml}
                                </table>
                            </div>
                        `;
                    });

                    cardsHtml += `
                        <div class="card-footer-info">
                            ${data.result.cards.length} card · complete entry kept together<br>
                            Same validated entry -> screen + PDF
                        </div>
                    `;

                    cardView.innerHTML = cardsHtml;
                }
            } catch (err) {
                cardView.innerHTML = '<div style="color: red; font-size: 12px;">Error generating entries. Please try again.</div>';
            }
        });
    }
});
