chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "summarize",
            title: "Define It Now!",
            contexts: ["selection"]
        });
    });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "summarize") {
        const selectedText = info.selectionText.trim();
        const wordCount = selectedText.split(' ').length;
        if (selectedText) {
            if (wordCount === 1)
                getCachedOrFetchDefinition(selectedText, tab.id);
            else if (wordCount < 5)
                sendMessageToContentScript(tab.id, 'Please select a sentence with at least five words.');
            else {
                sendMessageToContentScript(tab.id, 'Loading...', true);
                getCachedOrFetchSummary(selectedText, tab.id);
            }
        }
    }
});
function getCachedOrFetchDefinition(word, tabId) {
    chrome.storage.local.get([word], (result) => {
        if (result[word])
            sendMessageToContentScript(tabId, result[word]);
        else {
            retryFetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`, 3)
                .then(response => response.json())
                .then(data => {
                    let definition;
                    if (data.title === "No Definitions Found")
                        definition = 'No definition found.';
                    else
                        definition = data[0].meanings[0].definitions[0].definition;
                    chrome.storage.local.set({ [word]: definition }, () => {
                        sendMessageToContentScript(tabId, definition);
                    });
                })
                .catch(error => {
                    handleNetworkError(tabId, error);
                });
        }
    });
}
function getCachedOrFetchSummary(text, tabId) {
    const cacheKey = `summary_${text}`;
    chrome.storage.local.get([cacheKey], (result) => {
        if (result[cacheKey])
            sendMessageToContentScript(tabId, result[cacheKey]);
        else {
            retryFetch('http://localhost:5000/summarize', 3, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: text }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.error)
                    sendMessageToContentScript(tabId, 'Error: ' + data.error);
                else {
                    const summary = data[0].summary_text;
                    chrome.storage.local.set({ [cacheKey]: summary }, () => {
                        sendMessageToContentScript(tabId, summary);
                    });
                }
            })
            .catch(error => {
                handleNetworkError(tabId, error);
            });
        }
    });
}
function retryFetch(url, retries, options = {}) {
    return new Promise((resolve, reject) => {
        function fetchAttempt(attempt) {
            fetch(url, options)
                .then(resolve)
                .catch(error => {
                    if (attempt === 1)
                        reject(error);
                    else
                        setTimeout(() => fetchAttempt(attempt - 1), 1000);
                });
        }
        fetchAttempt(retries);
    });
}
function handleNetworkError(tabId, error) {
    if (error.message === 'Failed to fetch')
        sendMessageToContentScript(tabId, 'Please check your internet connection.');
    else {
        console.error('API error:', error);
        sendMessageToContentScript(tabId, 'An error occurred: ' + error.message);
    }
}
function sendMessageToContentScript(tabId, message, isLoading = false) {
    chrome.scripting.executeScript(
        {
            target: { tabId: tabId },
            func: (summary, isLoading) => {
                const existingSummaryDiv = document.getElementById('summaryDiv');
                if (existingSummaryDiv)
                    existingSummaryDiv.remove();
                const style = document.createElement('style');
                style.innerHTML = `
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes fadeOut {
                        from { opacity: 1; transform: translateY(0); }
                        to { opacity: 0; transform: translateY(20px); }
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    .summary-div {
                        position: absolute;
                        background-color: #fff;
                        border: 1px solid #ccc;
                        padding: 15px;
                        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                        z-index: 10000;
                        width: 300px;
                        border-radius: 8px;
                        font-size: 14px;
                        line-height: 1.6;
                        color: #333;
                        font-family: Arial, sans-serif;
                        animation: fadeIn 0.5s ease-out;
                    }
                    .summary-div.fade-out {
                        animation: fadeOut 0.5s ease-out forwards;
                    }
                    .summary-div h2 {
                        font-size: 20px;
                        margin: 0 0 10px 0;
                        color: #333;
                    }
                    .summary-div p {
                        color: #555;
                        margin-top: 10px;
                    }
                    .loading-spinner {
                        border: 4px solid rgba(0, 0, 0, 0.1);
                        border-radius: 50%;
                        border-top: 4px solid #333;
                        width: 24px;
                        height: 24px;
                        animation: spin 1s linear infinite;
                        margin: auto;
                    }
                `;
                document.head.appendChild(style);
                const summaryDiv = document.createElement('div');
                summaryDiv.id = 'summaryDiv';
                summaryDiv.className = 'summary-div';
                const heading = document.createElement('h2');
                heading.innerText = 'Define It Now!';
                summaryDiv.appendChild(heading);
                const textDiv = document.createElement('p');
                if (isLoading) {
                    const spinner = document.createElement('div');
                    spinner.className = 'loading-spinner';
                    textDiv.appendChild(spinner);
                } else
                    textDiv.innerText = summary;
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
                        summaryDiv.classList.add('fade-out');
                        setTimeout(() => summaryDiv.remove(), 500);
                        document.removeEventListener('click', handleClickOutside);
                    }
                }
                document.addEventListener('click', handleClickOutside);
            },
            args: [message, isLoading]
        },
        (results) => {
            if (chrome.runtime.lastError)
                console.error("Script injection error:", chrome.runtime.lastError);
            else
                console.log("Message sent successfully");
        }
    );
}