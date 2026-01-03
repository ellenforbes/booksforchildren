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
        // First get the book UID and ratings from books table
        var bookResult = await supabaseClient.from('books').select('uid, child_rating, adult_rating')
            .ilike('title', selectedBook.book)
            .ilike('author', selectedBook.author)
            .single();

        if (bookResult.error) {
            alert('Book not found in database. Please use "Add New Book" instead.');
            return;
        }
        
        selectedBookUid = bookResult.data.uid;

        // Set the rating dropdowns to current values
        document.getElementById('updateChildRating').value = bookResult.data.child_rating || '';
        document.getElementById('updateAdultRating').value = bookResult.data.adult_rating || '';

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
    var childRating = document.getElementById('updateChildRating').value;
    var adultRating = document.getElementById('updateAdultRating').value;

    try {
        // Update ratings in books table if they've changed
        var updateData = {};
        if (childRating) updateData.child_rating = parseInt(childRating);
        if (adultRating) updateData.adult_rating = parseInt(adultRating);
        
        if (Object.keys(updateData).length > 0) {
            var ratingUpdateResult = await supabaseClient.from('books')
                .update(updateData)
                .eq('uid', selectedBookUid);
            
            if (ratingUpdateResult.error) throw ratingUpdateResult.error;
        }

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
    var childRating = document.getElementById('newChildRating').value;
    var adultRating = document.getElementById('newAdultRating').value;
    var timesRead = parseInt(document.getElementById('newTimesRead').value);
    var comment = document.getElementById('newComment').value;

    console.log('Attempting to save book:', { title, author, type, childRating, adultRating });

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

        console.log('Book check result:', bookCheckResult);

        var bookUid;

        if (bookCheckResult.data) {
            console.log('Book exists, updating...');
            // Book exists, update it with ratings if provided
            if (childRating || adultRating) {
                var updateData = {};
                if (childRating) updateData.child_rating = parseInt(childRating);
                if (adultRating) updateData.adult_rating = parseInt(adultRating);
                
                var updateResult = await supabaseClient.from('books')
                    .update(updateData)
                    .eq('uid', bookCheckResult.data.uid);
                
                console.log('Update result:', updateResult);
            }
            bookUid = bookCheckResult.data.uid;
        } else {
            console.log('Book does not exist, creating new...');
            // Book doesn't exist, create it
            var newBookData = {
                title: title,
                author: author,
                type: type
            };
            
            if (childRating) newBookData.child_rating = parseInt(childRating);
            if (adultRating) newBookData.adult_rating = parseInt(adultRating);
            
            console.log('New book data:', newBookData);
            
            var newBookResult = await supabaseClient.from('books').insert(newBookData).select('uid').single();

            console.log('New book result:', newBookResult);

            if (newBookResult.error) {
                console.error('Error creating book:', newBookResult.error);
                throw newBookResult.error;
            }
            bookUid = newBookResult.data.uid;
            console.log('New book UID:', bookUid);
        }

        // Now insert into book_counter
        console.log('Inserting into book_counter with UID:', bookUid);
        var counterResult = await supabaseClient.from('book_counter').insert({
            book_uid: bookUid,
            reader: selectedReader,
            times_read: timesRead,
            comment: comment
        });

        console.log('Counter result:', counterResult);

        if (counterResult.error) {
            console.error('Error creating counter:', counterResult.error);
            throw counterResult.error;
        }

        alert('New book added successfully!');
        closeLogBookModal();
        loadData();
        //location.reload();
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


// Load book ratings from lookup table
async function loadBookRatings() {
    try {
        var ratingsResult = await supabaseClient.from('lookup_bookratings')
            .select('rater, rating_description, rating_integer')
            .order('rating_integer');

        if (ratingsResult.error) throw ratingsResult.error;

        if (ratingsResult.data) {
            // Filter child and adult ratings
            var childRatings = ratingsResult.data.filter(function(r) { return r.rater === 'child'; });
            var adultRatings = ratingsResult.data.filter(function(r) { return r.rater === 'adult'; });

            // Generate options HTML
            var childOptions = '<option value="">Select rating...</option>' + 
                childRatings.map(function(rating) {
                    return '<option value="' + rating.rating_integer + '">' + 
                           rating.rating_description + '</option>';
                }).join('');
            
            var adultOptions = '<option value="">Select rating...</option>' + 
                adultRatings.map(function(rating) {
                    return '<option value="' + rating.rating_integer + '">' + 
                           rating.rating_description + '</option>';
                }).join('');

            // Populate Add New Book dropdowns
            document.getElementById('newChildRating').innerHTML = childOptions;
            document.getElementById('newAdultRating').innerHTML = adultOptions;

            // Populate Update Log dropdowns
            document.getElementById('updateChildRating').innerHTML = childOptions;
            document.getElementById('updateAdultRating').innerHTML = adultOptions;
        }
    } catch (error) {
        console.error('Error loading book ratings:', error);
    }
}

// Load activity options and user names
async function loadActivityTrackerData() {
    try {
        // Load unique activities from activity_minutes table
        var minutesResult = await supabaseClient.from('activity_minutes').select('activity');
        
        var minutesActivities = new Set();
        if (minutesResult.data) {
            minutesResult.data.forEach(function(item) {
                if (item.activity) {
                    minutesActivities.add(item.activity);
                }
            });
        }

        // Load unique activities from activity_times table
        var timesResult = await supabaseClient.from('activity_times').select('activity');
        
        var timesActivities = new Set();
        if (timesResult.data) {
            timesResult.data.forEach(function(item) {
                if (item.activity) {
                    timesActivities.add(item.activity);
                }
            });
        }

        // Populate activityList1 with only activity_minutes activities
        var minutesArray = Array.from(minutesActivities).sort();
        var datalist1 = document.getElementById('activityList1');
        datalist1.innerHTML = minutesArray.map(function(activity) {
            return '<option value="' + activity + '">';
        }).join('');

        // Populate activityList2 with only activity_times activities
        var timesArray = Array.from(timesActivities).sort();
        var datalist2 = document.getElementById('activityList2');
        datalist2.innerHTML = timesArray.map(function(activity) {
            return '<option value="' + activity + '">';
        }).join('');

        // Load users from lookup_users table
        var usersResult = await supabaseClient.from('lookup_users').select('name').order('name');
        
        if (usersResult.data && usersResult.data.length > 0) {
            var userOptions = usersResult.data.map(function(user) {
                return '<option value="' + user.name + '"' + 
                       (user.name === 'Ellen' ? ' selected' : '') + '>' + 
                       user.name + '</option>';
            }).join('');
            
            document.getElementById('completer1').innerHTML = userOptions;
            document.getElementById('completer2').innerHTML = userOptions;
            document.getElementById('completer3').innerHTML = userOptions;
        } else {
            // Fallback if no users found
            document.getElementById('completer1').innerHTML = '<option value="Ellen">Ellen</option>';
            document.getElementById('completer2').innerHTML = '<option value="Ellen">Ellen</option>';
            document.getElementById('completer3').innerHTML = '<option value="Ellen">Ellen</option>';
        }
    } catch (error) {
        console.error('Error loading activity tracker data:', error);
    }
}

async function submitActivityMinutes() {
    var completer = document.getElementById('completer1').value;
    var minutes = parseInt(document.getElementById('minutes').value);
    var activity = document.getElementById('activity1').value.trim();

    if (!activity || !minutes || minutes <= 0) {
        alert('Please fill in all fields with valid values');
        return;
    }

    try {
        var today = new Date().toISOString();
        
        var result = await supabaseClient.from('activity_minutes').insert({
            activity: activity,
            minutes: minutes,
            date_completed: today,
            completer: completer
        });

        if (result.error) throw result.error;

        alert('Activity logged successfully!');
        document.getElementById('minutes').value = 20;
        document.getElementById('activity1').value = '';
        loadActivityTrackerData(); // Refresh the activity list
    } catch (error) {
        console.error('Error submitting activity minutes:', error);
        alert('Error logging activity: ' + error.message);
    }
}

async function submitActivityTimes() {
    var completer = document.getElementById('completer2').value;
    var times = parseInt(document.getElementById('times').value);
    var activity = document.getElementById('activity2').value.trim();

    if (!activity || !times || times <= 0) {
        alert('Please fill in all fields with valid values');
        return;
    }

    try {
        var today = new Date().toISOString();
        
        var result = await supabaseClient.from('activity_times').insert({
            activity: activity,
            times: times,
            date_completed: today,
            completer: completer
        });

        if (result.error) throw result.error;

        alert('Activity logged successfully!');
        document.getElementById('times').value = 5;
        document.getElementById('activity2').value = '';
        loadActivityTrackerData(); // Refresh the activity list
    } catch (error) {
        console.error('Error submitting activity times:', error);
        alert('Error logging activity: ' + error.message);
    }
}

async function submitOverheard() {
    var completer = document.getElementById('completer3').value;
    var overheardText = document.getElementById('overheardText').value.trim();

    if (!overheardText) {
        alert('Please enter what you overheard');
        return;
    }

    try {
        var now = new Date().toISOString();
        
        var result = await supabaseClient.from('things_overheard').insert({
            overheard: overheardText,
            date_completed: now,
            completer: completer
        });

        if (result.error) throw result.error;

        alert('Overheard entry saved successfully!');
        document.getElementById('overheardText').value = '';
    } catch (error) {
        console.error('Error submitting overheard:', error);
        alert('Error saving entry: ' + error.message);
    }
}

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
    loadBarChart(); 
    loadActivityTrackerData();
    loadBookRatings(); 
    
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