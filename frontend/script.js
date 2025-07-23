document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('url');
    const selectorInput = document.getElementById('selector');
    const testCrawlButton = document.getElementById('testCrawlButton');
    const addItemButton = document.getElementById('addItemButton');
    const testCrawlResultDiv = document.getElementById('testCrawlResult');
    const itemsListDiv = document.getElementById('itemsList');

    // Function to fetch and display items
    const fetchItems = async () => {
        try {
            const response = await fetch('/items');
            const data = await response.json();

            if (data.success) {
                itemsListDiv.innerHTML = '<h2>Tracked Items</h2>'; // Clear previous list
                data.items.forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.classList.add('item');
                    itemDiv.innerHTML = `
                        <h3>${item.url}</h3>
                        <p>Selector: ${item.selector}</p>
                        <button class="viewHistoryButton" data-item-id="${item.id}">View History</button>
                        <div class="history" style="display: none;"></div>
                    `;
                    itemsListDiv.appendChild(itemDiv);
                });

                // Add event listeners to view history buttons
                document.querySelectorAll('.viewHistoryButton').forEach(button => {
                    button.addEventListener('click', handleViewHistoryClick);
                });

            } else {
                itemsListDiv.innerHTML = '<p>Error loading items.</p>';
            }
        } catch (error) {
            console.error('Error fetching items:', error);
            itemsListDiv.innerHTML = '<p>Error loading items.</p>';
        }
    };

    // Function to handle test crawl button click
    testCrawlButton.addEventListener('click', async () => {
        const url = urlInput.value;
        const selector = selectorInput.value;

        if (!url || !selector) {
            testCrawlResultDiv.textContent = 'Please enter both URL and selector.';
            testCrawlResultDiv.style.color = 'red';
            addItemButton.disabled = true;
            return;
        }

        testCrawlResultDiv.textContent = 'Testing...';
        testCrawlResultDiv.style.color = 'black';
        addItemButton.disabled = true;

        try {
            const response = await fetch('/test-crawl', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url, selector }),
            });

            const data = await response.json();

            if (data.success) {
                testCrawlResultDiv.textContent = `Test successful. Current price: ${data.price}`;
                testCrawlResultDiv.style.color = 'green';
                addItemButton.disabled = false;
            } else {
                testCrawlResultDiv.textContent = `Test failed: ${data.error}`;
                testCrawlResultDiv.style.color = 'red';
                addItemButton.disabled = true;
            }
        } catch (error) {
            console.error('Error during test crawl:', error);
            testCrawlResultDiv.textContent = 'An error occurred during the test.';
            testCrawlResultDiv.style.color = 'red';
            addItemButton.disabled = true;
        }
    });

    // Function to handle add item button click
    addItemButton.addEventListener('click', async () => {
        const url = urlInput.value;
        const selector = selectorInput.value;

        if (!url || !selector) {
            return; // Should not happen if button is disabled correctly
        }

        try {
            const response = await fetch('/items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url, selector }),
            });

            const data = await response.json();

            if (data.success) {
                alert('Item added successfully!');
                urlInput.value = ''; // Clear form
                selectorInput.value = '';
                testCrawlResultDiv.textContent = '';
                addItemButton.disabled = true;
                fetchItems(); // Refresh item list
            } else {
                alert(`Error adding item: ${data.error}`);
            }
        } catch (error) {
            console.error('Error adding item:', error);
            alert('An error occurred while adding the item.');
        }
    });

    // Function to handle view history button click
    const handleViewHistoryClick = async (event) => {
        const button = event.target;
        const itemId = button.dataset.itemId;
        const historyDiv = button.nextElementSibling;

        if (historyDiv.style.display === 'none') {
            // Fetch history
            try {
                const response = await fetch(`/items/${itemId}/history`);
                const data = await response.json();

                if (data.success) {
                    historyDiv.innerHTML = '<h4>History</h4>';
                    if (data.history.length > 0) {
                        data.history.forEach(entry => {
                            const historyEntryDiv = document.createElement('div');
                            historyEntryDiv.classList.add('history-entry');
                            const timestamp = new Date(entry.timestamp._seconds * 1000).toLocaleString();
                            historyEntryDiv.textContent = `${timestamp}: ${entry.price}`;
                            historyDiv.appendChild(historyEntryDiv);
                        });
                    } else {
                        historyDiv.innerHTML += '<p>No history available.</p>';
                    }
                    historyDiv.style.display = 'block';
                    button.textContent = 'Hide History';
                } else {
                    historyDiv.innerHTML = '<p>Error loading history.</p>';
                    historyDiv.style.color = 'red';
                    historyDiv.style.display = 'block';
                }
            } catch (error) {
                console.error('Error fetching history:', error);
                historyDiv.innerHTML = '<p>An error occurred loading history.</p>';
                historyDiv.style.color = 'red';
                historyDiv.style.display = 'block';
            }
        } else {
            historyDiv.style.display = 'none';
            button.textContent = 'View History';
        }
    };

    // Initial fetch of items when the page loads
    fetchItems();
});
