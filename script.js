var SUPABASE_URL = 'https://ucjyvnxdkxbtkmintcwh.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_JwxhiRPMElH2122z7su8pg_0kf3SAiF';
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var allBooks = [];
var allReaders = [];
var selectedBook = null;
var selectedBookUid = null;
var selectedReader = 'Ellen';
var isNewEntry = false;
var existingTimesRead = 0; // Store the existing read count

async function loadData() {
    try {
        var booksResult = await supabaseClient.from('books').select('title, author').order('title');
        if (booksResult.error) throw booksResult.error;
        
        allBooks = booksResult.data.map(function(b) {
            return { book: b.title, author: b.author };
        });

        var readersResult = await supabaseClient.from('book_counter').select('reader').order('reader');
        if (readersResult.error) throw readersResult.error;
        
        var uniqueReaders = [];
        var readerSet = new Set();
        readersResult.data.forEach(function(r) {
            if (!readerSet.has(r.reader)) {
                readerSet.add(r.reader);
                uniqueReaders.push(r.reader);
            }
        });
        allReaders = uniqueReaders;
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function openLogBookModal() {
    showStep1();
    document.getElementById('logBookModal').classList.add('active');
    populateReaderDropdown();
}

function closeLogBookModal() {
    document.getElementById('logBookModal').classList.remove('active');
    resetModal();
}

function resetModal() {
    selectedBook = null;
    selectedBookUid = null;
    selectedReader = 'Ellen';
    isNewEntry = false;
    existingTimesRead = 0;
    document.getElementById('bookSearch').value = '';
    document.getElementById('autocompleteResults').innerHTML = '';
    document.getElementById('autocompleteResults').style.display = 'none';
}

function showStep1() {
    document.getElementById('modalStep1').style.display = 'block';
    document.getElementById('modalStep2a').style.display = 'none';
    document.getElementById('modalStep2b').style.display = 'none';
}

function showStep2a() {
    document.getElementById('modalStep1').style.display = 'none';
    document.getElementById('modalStep2a').style.display = 'block';
    document.getElementById('modalStep2b').style.display = 'none';
}

function showStep2b() {
    document.getElementById('modalStep1').style.display = 'none';
    document.getElementById('modalStep2a').style.display = 'none';
    document.getElementById('modalStep2b').style.display = 'block';
}

function populateReaderDropdown() {
    var select = document.getElementById('readerSelect');
    select.innerHTML = '';
    
    if (allReaders.length === 0) {
        var option = document.createElement('option');
        option.value = 'Ellen';
        option.textContent = 'Ellen';
        option.selected = true;
        select.appendChild(option);
    } else {
        allReaders.forEach(function(reader) {
            var option = document.createElement('option');
            option.value = reader;
            option.textContent = reader;
            if (reader === 'Ellen') option.selected = true;
            select.appendChild(option);
        });
    }
}

function selectBook(book, author) {
    selectedBook = { book: book, author: author };
    document.getElementById('bookSearch').value = book + ' - ' + author;
    document.getElementById('autocompleteResults').style.display = 'none';
}

async function handleLog() {
    if (!selectedBook) {
        alert('Please select a book');
        return;
    }
    if (!selectedReader) {
        alert('Please select a reader');
        return;
    }

    try {
        // First get the book UID from books table
        var bookResult = await supabaseClient.from('books').select('uid')
            .ilike('title', selectedBook.book)
            .ilike('author', selectedBook.author)
            .single();

        if (bookResult.error) {
            alert('Book not found in database. Please use "Add New Book" instead.');
            return;
        }
        
        selectedBookUid = bookResult.data.uid;

        // Now get the book_counter entry
        var counterResult = await supabaseClient.from('book_counter').select('*')
            .eq('book_uid', selectedBookUid)
            .eq('reader', selectedReader)
            .maybeSingle();

        if (counterResult.error && counterResult.error.code !== 'PGRST116') throw counterResult.error;

        if (counterResult.data) {
            // Existing entry found - update mode
            isNewEntry = false;
            existingTimesRead = counterResult.data.times_read || 0;
            document.getElementById('timesAlreadyRead').value = existingTimesRead;
            document.getElementById('readsToAdd').value = 1;
            document.getElementById('existingComment').value = counterResult.data.comment || '';
        } else {
            // No entry for this reader yet - create mode
            isNewEntry = true;
            existingTimesRead = 0;
            document.getElementById('timesAlreadyRead').value = 0;
            document.getElementById('readsToAdd').value = 1;
            document.getElementById('existingComment').value = '';
        }
        
        showStep2a();
    } catch (error) {
        console.error('Error fetching book data:', error);
        alert('Error fetching book data');
    }
}

function handleAddNew() {
    if (!selectedReader) {
        alert('Please select a reader');
        return;
    }

    if (selectedBook) {
        document.getElementById('newTitle').value = selectedBook.book;
        document.getElementById('newAuthor').value = selectedBook.author;
    } else {
        document.getElementById('newTitle').value = '';
        document.getElementById('newAuthor').value = '';
    }
    document.getElementById('newTimesRead').value = 1;
    document.getElementById('newComment').value = '';
    
    showStep2b();
}

async function saveLog() {
    var readsToAdd = parseInt(document.getElementById('readsToAdd').value) || 0;
    var totalTimesRead = existingTimesRead + readsToAdd;
    var comment = document.getElementById('existingComment').value;

    try {
        if (isNewEntry) {
            // Create new entry
            var result = await supabaseClient.from('book_counter').insert({
                book_uid: selectedBookUid,
                reader: selectedReader,
                times_read: totalTimesRead,
                comment: comment
            });

            if (result.error) throw result.error;
            alert('Book log created successfully!');
        } else {
            // Update existing entry
            var result = await supabaseClient.from('book_counter').update({
                times_read: totalTimesRead,
                comment: comment
            }).eq('book_uid', selectedBookUid)
                .eq('reader', selectedReader);

            if (result.error) throw result.error;
            alert('Book log updated successfully!');
        }

        closeLogBookModal();
        location.reload();
    } catch (error) {
        console.error('Error saving log:', error);
        alert('Error saving log: ' + error.message);
    }
}

async function saveNewBook() {
    var title = document.getElementById('newTitle').value;
    var author = document.getElementById('newAuthor').value;
    var type = document.getElementById('newType').value;
    var timesRead = parseInt(document.getElementById('newTimesRead').value);
    var comment = document.getElementById('newComment').value;

    if (!title || !author || !type) {
        alert('Please fill in all required fields');
        return;
    }

    try {
        // First check if book exists in books table
        var bookCheckResult = await supabaseClient.from('books').select('uid')
            .ilike('title', title)
            .ilike('author', author)
            .maybeSingle();

        var bookUid;

        if (bookCheckResult.data) {
            // Book exists, use its UID
            bookUid = bookCheckResult.data.uid;
        } else {
            // Book doesn't exist, create it
            var newBookResult = await supabaseClient.from('books').insert({
                title: title,
                author: author,
                type: type
            }).select('uid').single();

            if (newBookResult.error) throw newBookResult.error;
            bookUid = newBookResult.data.uid;
        }

        // Now insert into book_counter
        var counterResult = await supabaseClient.from('book_counter').insert({
            book_uid: bookUid,
            reader: selectedReader,
            times_read: timesRead,
            comment: comment
        });

        if (counterResult.error) throw counterResult.error;

        alert('New book added successfully!');
        closeLogBookModal();
        loadData();
        location.reload();
    } catch (error) {
        console.error('Error adding new book:', error);
        alert('Error adding new book: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadData();
    
    var bookSearch = document.getElementById('bookSearch');
    var autocompleteResults = document.getElementById('autocompleteResults');

    bookSearch.addEventListener('input', function() {
        var searchTerm = this.value.toLowerCase();
        
        if (searchTerm.length === 0) {
            autocompleteResults.style.display = 'none';
            selectedBook = null;
            return;
        }

        var matches = allBooks.filter(function(book) {
            return book.book.toLowerCase().includes(searchTerm) || 
                    book.author.toLowerCase().includes(searchTerm);
        });

        if (matches.length > 0) {
            autocompleteResults.innerHTML = matches.map(function(book) {
                var safeBook = book.book.replace(/'/g, "\\'");
                var safeAuthor = book.author.replace(/'/g, "\\'");
                return '<div class="autocomplete-item" onclick="selectBook(\'' + safeBook + '\', \'' + safeAuthor + '\')">' + 
                        book.book + ' - ' + book.author + '</div>';
            }).join('');
            autocompleteResults.style.display = 'block';
        } else {
            autocompleteResults.style.display = 'none';
        }
    });

    document.getElementById('readerSelect').addEventListener('change', function() {
        selectedReader = this.value;
    });
});

window.onclick = function(event) {
    var modal = document.getElementById('logBookModal');
    if (event.target === modal) {
        closeLogBookModal();
    }
};


// Add this function to fetch and display the bar chart
async function loadBarChart() {
    try {
        var result = await supabaseClient
            .from('top_10_most_read_books')
            .select('title, read_count')
            .order('read_count', { ascending: false });

        if (result.error) throw result.error;

        var chartContainer = document.getElementById('barChart');
        
        if (!result.data || result.data.length === 0) {
            chartContainer.innerHTML = '<div class="no-data">No reading data available yet.</div>';
            return;
        }

        // Find max value for scaling
        var maxReads = Math.max(...result.data.map(function(book) { return book.read_count; }));

        // Generate bar chart HTML
        var chartHTML = result.data.map(function(book) {
            var percentage = (book.read_count / maxReads) * 100;
            return '<div class="bar-item">' +
                   '<div class="bar-wrapper">' +
                   '<div class="bar-label">' + book.title + '</div>' +
                   '<div class="bar-fill" style="width: ' + percentage + '%">' +
                   '<span class="bar-value">' + book.read_count + '</span>' +
                   '</div>' +
                   '</div>' +
                   '</div>';
        }).join('');

        chartContainer.innerHTML = chartHTML;
    } catch (error) {
        console.error('Error loading bar chart:', error);
        document.getElementById('barChart').innerHTML = '<div class="error">Error loading chart data</div>';
    }
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    loadBarChart(); // Add this line
    
    // ... rest of your existing DOMContentLoaded code
    var bookSearch = document.getElementById('bookSearch');
    var autocompleteResults = document.getElementById('autocompleteResults');

    bookSearch.addEventListener('input', function() {
        var searchTerm = this.value.toLowerCase();
        
        if (searchTerm.length === 0) {
            autocompleteResults.style.display = 'none';
            selectedBook = null;
            return;
        }

        var matches = allBooks.filter(function(book) {
            return book.book.toLowerCase().includes(searchTerm) || 
                    book.author.toLowerCase().includes(searchTerm);
        });

        if (matches.length > 0) {
            autocompleteResults.innerHTML = matches.map(function(book) {
                var safeBook = book.book.replace(/'/g, "\\'");
                var safeAuthor = book.author.replace(/'/g, "\\'");
                return '<div class="autocomplete-item" onclick="selectBook(\'' + safeBook + '\', \'' + safeAuthor + '\')">' + 
                        book.book + ' - ' + book.author + '</div>';
            }).join('');
            autocompleteResults.style.display = 'block';
        } else {
            autocompleteResults.style.display = 'none';
        }
    });

    document.getElementById('readerSelect').addEventListener('change', function() {
        selectedReader = this.value;
    });
});