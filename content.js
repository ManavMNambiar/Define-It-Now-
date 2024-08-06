chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showSummary') {
        displaySummary(request.summary);
        sendResponse({ status: "Summary displayed" });
    }
    return true;
});
function displaySummary(text) {
    const existingSummaryDiv = document.getElementById('summaryDiv');
    if (existingSummaryDiv)
        existingSummaryDiv.remove();
    const summaryDiv = document.createElement('div');
    summaryDiv.id = 'summaryDiv';
    summaryDiv.style.position = 'absolute';
    summaryDiv.style.backgroundColor = '#fff';
    summaryDiv.style.border = '1px solid #ccc';
    summaryDiv.style.padding = '15px';
    summaryDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    summaryDiv.style.zIndex = 10000;
    summaryDiv.style.width = '300px';
    summaryDiv.style.borderRadius = '8px';
    summaryDiv.style.fontSize = '14px';
    summaryDiv.style.lineHeight = '1.6';
    summaryDiv.style.color = '#333';
    summaryDiv.style.fontFamily = 'Arial, sans-serif';
    const heading = document.createElement('h2');
    heading.innerText = 'Define It Now!';
    heading.style.fontSize = '20px';
    heading.style.margin = '0 0 10px 0';
    heading.style.color = '#333';
    summaryDiv.appendChild(heading);
    const textDiv = document.createElement('p');
    textDiv.innerText = text;
    textDiv.style.color = '#555';
    textDiv.style.marginTop = '10px';
    summaryDiv.appendChild(textDiv);
    document.body.appendChild(summaryDiv);
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        summaryDiv.style.top = `${window.scrollY + rect.bottom + 10}px`;
        summaryDiv.style.left = `${window.scrollX + rect.left}px`;
    }
    function handleClickOutside(event) {
        if (!summaryDiv.contains(event.target)) {
            summaryDiv.remove();
            document.removeEventListener('click', handleClickOutside);
        }
    }
    document.addEventListener('click', handleClickOutside);
}