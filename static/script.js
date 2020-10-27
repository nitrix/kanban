document.boards = [];

window.onerror = function (message, file, line, col, e) {
    alert("Error occurred: " + e.message);
    return false;
};

window.addEventListener("error", function (e) {
    alert("Error occurred: " + e.error.message);
    return false;
})

function Board(title) {
    this.title = title;
    this.lists = [];
}

function htmlEncode(raw) {
    return $('tt .encoder').text(raw).html();
}

function setText($note, text) {
    $note.attr('_text', text);

    text = htmlEncode(text);
    const rule = /\b(https?:\/\/[^\s]+)/mg;

    text = text.replace(rule, function (url) {
        return '<a href="' + url + '" target=_blank>' + url + '</a>';
    });

    $note.html(text);

    updatePageTitle();
}

function getText($note) {
    return $note.attr('_text');
}

function updatePageTitle() {
    if (!document.board) {
        document.title = 'Kanban';
        return;
    }

    const $text = $('.wrap .board > .head .text');
    const title = getText($text);

    document.board.title = title;
    document.title = 'Kanban - ' + (title || '(unnamed board)');
}

function showBoard(quick) {
    const board = document.board;

    const $wrap = $('.wrap');
    const $bdiv = $('tt .board');
    const $ldiv = $('tt .list');
    const $ndiv = $('tt .note');

    const $b = $bdiv.clone();
    const $b_lists = $b.find('.lists');

    $b[0].board_id = board.id;

    if (board.id) {
        $b.attr('board-id', board.id);
    } else {
        $b.removeAttr('board-id');
    }

    setText($b.find('.head .text'), board.title);

    board.lists.forEach(function (list) {
        const $l = $ldiv.clone();
        const $l_notes = $l.find('.notes');

        $l.attr('list-id', list.id);
        setText($l.find('.head .text'), list.title);

        list.notes.forEach(function (n) {
            const $n = $ndiv.clone();
            $n.attr('note-id', n.id);
            setText($n.find('.text'), n.text);
            if (n.raw) $n.addClass('raw');
            if (n.min) $n.addClass('collapsed');
            $l_notes.append($n);
        });

        $b_lists.append($l);
    });

    if (quick)
        $wrap.html('').append($b);
    else
        $wrap.html('')
            .css({opacity: 0})
            .append($b)
            .animate({opacity: 1});

    updatePageTitle();
    updateBoardMenu();
    setupListScrolling();
}

function startEditing($text) {
    const $note = $text.parent();
    const $edit = $note.find('.edit');

    $note[0]._collapsed = $note.hasClass('collapsed');
    $note.removeClass('collapsed');

    $edit.val(getText($text));
    $edit.width($text.width());
    $edit.height($text.height());
    $note.addClass('editing');

    $edit.focus();
}

function stopEditing($edit, via_escape) {
    const $item = $edit.parent();
    if (!$item.hasClass('editing'))
        return;

    $item.removeClass('editing');
    if ($item[0]._collapsed)
        $item.addClass('collapsed')

    const $text = $item.find('.text');
    const text_now = $edit.val().trimRight();
    const text_was = getText($text);

    const brand_new = $item.hasClass('brand-new');
    $item.removeClass('brand-new');

    if (brand_new && text_now === "") {
        $item.closest('.note, .list, .board').remove();
        return;
    }

    if (via_escape) {
        if (brand_new) {
            $item.closest('.note, .list, .board').remove();
            return;
        }
    } else if (text_now !== text_was || brand_new) {
        setText($text, text_now);

        if ($item.attr('note-id')) {
            ws.send(JSON.stringify({
                'command': 'EDIT_NOTE',
                'data': {
                    id: parseInt($item.attr('note-id')),
                    text: text_now,
                },
            }));
        } else if ($item.parents('.notes').length > 0) {
            ws.send(JSON.stringify({
                'command': 'ADD_NOTE',
                'data': {
                    list_id: parseInt($item.closest('.list').attr('list-id')),
                    text: text_now,
                },
            }));
        }

        if ($item.parent('.list').attr('list-id')) {
            ws.send(JSON.stringify({
                'command': 'EDIT_LIST',
                'data': {
                    id: parseInt($item.parent('.list').attr('list-id')),
                    title: text_now,
                },
            }));
        }
        else if ($item.hasClass('head') && $item.parent('.list:not([list-id])').length > 0) {
            ws.send(JSON.stringify({
                'command': 'ADD_LIST',
                'data': {
                    board_id: parseInt($('.board').attr('board-id')),
                    title: text_now,
                },
            }));
        }

        if ($item.parent('.board').attr('board-id') && !brand_new) {
            ws.send(JSON.stringify({
                'command': 'EDIT_BOARD',
                'data': {
                    id: parseInt($item.parent('.board').attr('board-id')),
                    title: text_now,
                },
            }));
        }
        else if ($item.parent('.board') && $item.parent('.board:not([board-id])').length > 0 && brand_new) {
            ws.send(JSON.stringify({
                'command': 'ADD_BOARD',
                'data': {
                    title: text_now,
                },
            }));
        }
    }

    if (brand_new && $item.hasClass('list'))
        addNote($item);
}

function addNote($list, $after, $before) {
    let $note = $('tt .note').clone();
    let $notes = $list.find('.notes');

    $note.find('.text').html('');
    $note.addClass('brand-new');

    if ($before) {
        $before.before($note);
        $note = $before.prev();
    } else if ($after) {
        $after.after($note);
        $note = $after.next();
    } else {
        $notes.append($note);
        $note = $notes.find('.note').last();
    }

    $note.find('.text').click();
}

function deleteNote($note) {
    $note
        .animate({opacity: 0}, 'fast')
        .slideUp('fast')
        .queue(function () {
            $note.remove();
        });
}

function addList() {
    const $board = $('.wrap .board');
    const $lists = $board.find('.lists');
    const $list = $('tt .list').clone();

    $list.find('.text').html('');
    $list.find('.head').addClass('brand-new');

    $lists.append($list);
    $board.find('.lists .list .head .text').last().click();

    const lists = $lists[0];
    lists.scrollLeft = Math.max(0, lists.scrollWidth - lists.clientWidth);

    setupListScrolling();
}

function deleteList($list) {
    let empty = true;

    $list.find('.note .text').each(function () {
        empty &= ($(this).html().length === 0);
    });

    $list
        .animate({opacity: 0})
        .queue(function () {
            $list.remove();
        });

    setupListScrolling();
}

function moveList($list, left) {
    const $a = $list;
    const $b = left ? $a.prev() : $a.next();

    const $menu_a = $a.find('> .head .menu .bulk');
    const $menu_b = $b.find('> .head .menu .bulk');

    const pos_a = $a.offset().left;
    const pos_b = $b.offset().left;

    $a.css({position: 'relative'});
    $b.css({position: 'relative'});

    $menu_a.hide();
    $menu_b.hide();

    $a.animate({left: (pos_b - pos_a) + 'px'}, 'fast');
    $b.animate({left: (pos_a - pos_b) + 'px'}, 'fast', function () {

        if (left) $list.prev().before($list);
        else $list.before($list.next());

        $a.css({position: '', left: ''});
        $b.css({position: '', left: ''});

        $menu_a.css({display: ''});
        $menu_b.css({display: ''});
    });
}

function openBoard(board_id) {
    closeBoard(true);

    document.board = document.boards[board_id];

    // Keep track of the last opened board.
    $('.board').first().attr('board-id', board_id);
    localStorage.setItem('board_id', board_id);

    showBoard(true);
}

function closeBoard(quick) {
    const $board = $('.wrap .board');

    if (quick)
        $board.remove();
    else {
        $board
            .animate({opacity: 0}, 100)
            .queue(function () {
                $board.remove();
            });
    }

    document.board = null;

    updateBoardMenu();
}

function addBoard() {
    document.board = new Board('');

    showBoard(false);

    $('.wrap .board .head').addClass('brand-new');
    $('.wrap .board .head .text').click();
}

function deleteBoard() {
    ws.send(JSON.stringify({
        command: 'DELETE_BOARD',
        data: {
            id: parseInt($('.board').attr('board-id')),
        },
    }));

    closeBoard();
}

function Drag() {
    this.item = null; // .text of .note
    this.priming = null;
    this.primexy = {x: 0, y: 0};
    this.$drag = null;
    this.mouse = null;
    this.delta = {x: 0, y: 0};
    this.in_swap = false;

    this.prime = function (item, ev) {
        const self = this;
        this.item = item;
        this.priming = setTimeout(function () {
            self.onPrimed.call(self);
        }, ev.altKey ? 1 : 500);
        this.primexy.x = ev.clientX;
        this.primexy.y = ev.clientY;
        this.mouse = ev;
    }

    this.cancelPriming = function () {
        if (this.item && this.priming) {
            clearTimeout(this.priming);
            this.priming = null;
            this.item = null;
        }
    }

    this.end = function () {
        this.cancelPriming();
        this.stopDragging();
    }

    this.onPrimed = function () {
        clearTimeout(this.priming);
        this.priming = null;
        this.item.was_dragged = true;

        const $text = $(this.item);
        const $note = $text.parent();
        $note.addClass('dragging');

        const $body = $('body');

        $body.append('<div class=dragster></div>');
        const $drag = $('body .dragster').last();

        if ($note.hasClass('collapsed'))
            $drag.addClass('collapsed');

        $drag.html($text.html());

        $drag.innerWidth($note.innerWidth());
        $drag.innerHeight($note.innerHeight());

        this.$drag = $drag;

        const $win = $(window);
        const scroll_x = $win.scrollLeft();
        const scroll_y = $win.scrollTop();

        const pos = $note.offset();
        this.delta.x = pos.left - this.mouse.clientX - scroll_x;
        this.delta.y = pos.top - this.mouse.clientY - scroll_y;
        this.adjustDrag();

        $drag.css({opacity: 1});

        $body.addClass('dragging');
    }

    this.adjustDrag = function () {
        if (!this.$drag)
            return;

        const $win = $(window);
        const scroll_x = $win.scrollLeft();
        const scroll_y = $win.scrollTop();

        const drag_x = this.mouse.clientX + this.delta.x + scroll_x;
        const drag_y = this.mouse.clientY + this.delta.y + scroll_y;

        this.$drag.offset({left: drag_x, top: drag_y});

        if (this.in_swap)
            return;

        // see if a swap is in order
        const pos = this.$drag.offset();
        const x = pos.left + this.$drag.width() / 2 - $win.scrollLeft();
        const y = pos.top + this.$drag.height() / 2 - $win.scrollTop();

        const drag = this;
        let prepend = null;   // if dropping on the list header
        let target = null;    // if over some item
        let before = false;   // if should go before that item

        $(".board .list").each(function () {
            const list = this;
            const rc = list.getBoundingClientRect();
            let y_min = rc.bottom;
            let n_min = null;

            if (x <= rc.left || rc.right <= x || y <= rc.top || rc.bottom <= y)
                return;

            const $list = $(list);

            $list.find('.note').each(function () {
                const note = this;
                const rc = note.getBoundingClientRect();

                if (rc.top < y_min) {
                    y_min = rc.top;
                    n_min = note;
                }

                if (y <= rc.top || rc.bottom <= y)
                    return;

                if (note === drag.item.parentNode)
                    return;

                target = note;
                before = (y < (rc.top + rc.bottom) / 2);
            });

            // dropping on the list header
            if (!target && y < y_min) {
                if (n_min) // non-empty list
                {
                    target = n_min;
                    before = true;
                } else {
                    prepend = list;
                }
            }
        });

        if (!target && !prepend)
            return;

        if (target) {
            if (target === drag.item.parentNode)
                return;

            if (!before && target.nextSibling === drag.item.parentNode ||
                before && target.previousSibling === drag.item.parentNode)
                return;
        } else {
            if (prepend.firstChild === drag.item.parentNode)
                return;
        }

        // swap 'em
        const $have = $(this.item.parentNode);
        let $want = $have.clone();

        $want.css({display: 'none'});

        if (target) {
            const $target = $(target);

            if (before) {
                $want.insertBefore($target);
                $want = $target.prev();
            } else {
                $want.insertAfter($target);
                $want = $target.next();
            }

            drag.item = $want.find('.text')[0];
        } else {
            const $notes = $(prepend).find('.notes');

            $notes.prepend($want);

            drag.item = $notes.find('.note .text')[0];
        }

        const h = $have.height();

        drag.in_swap = true;

        //$have.animate({height: 0}, 'fast', function () {
            $have.remove();
            $want.css({marginTop: 5});
        //});

        $want.css({display: 'block', height: 0});
        //$want.animate({height: h}, 'fast', function () {
            $want.css({opacity: '', height: ''});
            drag.in_swap = false;
            drag.adjustDrag();
        //});
    }

    this.onMouseMove = function (ev) {
        this.mouse = ev;

        if (!this.item)
            return;

        if (this.priming) {
            const x = ev.clientX - this.primexy.x;
            const y = ev.clientY - this.primexy.y;

            if (x * x + y * y > 5 * 5)
                this.onPrimed();
        } else {
            this.adjustDrag();
        }
    }

    this.stopDragging = function () {
        $(this.item).parent().removeClass('dragging');
        $('body').removeClass('dragging');

        if (this.$drag) {
            this.$drag.remove();
            this.$drag = null;

            if (window.getSelection) {
                window.getSelection().removeAllRanges();
            } else if (document.selection) {
                document.selection.empty();
            }
        }

        const note_id = $(this.item).closest('.note').attr('note-id');
        const list_id = $(this.item).closest('.list').attr('list-id');
        const previous_note_id = $(this.item).closest('.note').prev().attr('note-id') || 0;

        if (note_id) {
            ws.send(JSON.stringify({
                command: 'EDIT_NOTE',
                data: {
                    id: parseInt(note_id),
                    list_id: parseInt(list_id),
                    previous_note_id: parseInt(previous_note_id),
                },
            }));
        }

        this.item = null;
    }
}

function updateBoardMenu() {
    const $index = $('.config .boards');
    const $entry = $('tt .load-board');

    //const id_now = document.board && document.board.id;

    //const board_id = localStorage.getItem('board_id');

    //if (board_id === id_now)
    //    $e.addClass('active');

    let empty = true;

    $index.html('');
    $index.hide();

    for (const key in document.boards) {
        const $e = $entry.clone();
        $e.attr('target-board-id', document.boards[key].id);
        $e.html(document.boards[key].title || '(unnamed board)');

        $index.append($e);
        empty = false;
    }

    if (!empty) $index.show();
}

const drag = new Drag();

function setRevealState(ev) {
    const raw = ev.originalEvent;
    const caps = raw.getModifierState && raw.getModifierState('CapsLock');

    if (caps) $('body').addClass('reveal');
    else $('body').removeClass('reveal');
}

$(window).live('blur', function (ev) {
    $('body').removeClass('reveal');
});

$(document).live('keydown', function (ev) {
    setRevealState(ev);
});

$(document).live('keyup', function (ev) {
    setRevealState(ev);
});

$('.board .text').live('click', function (ev) {
    if (this.was_dragged) {
        this.was_dragged = false;
        return false;
    }

    drag.cancelPriming();

    startEditing($(this), ev);
    return false;
});

$('.board .note .text a').live('click', function (ev) {
    if (!$('body').hasClass('reveal'))
        return true;

    ev.stopPropagation();
    return true;
});

function handleTab(ev) {
    const $this = $(this);
    const $note = $this.closest('.note');
    const $sibl = ev.shiftKey ? $note.prev() : $note.next();

    if ($sibl.length) {
        stopEditing($this, false);
        $sibl.find('.text').click();
    }
}

$('.board .edit').live('keydown', function (ev) {
    // esc
    if (ev.keyCode === 27) {
        stopEditing($(this), true);
        return false;
    }

    // tab
    if (ev.keyCode === 9) {
        handleTab.call(this, ev);
        return false;
    }

    // enter
    if (ev.keyCode === 13 && ev.ctrlKey) {
        const $this = $(this);
        const $note = $this.closest('.note');
        const $list = $note.closest('.list');

        stopEditing($this, false);

        if ($note && ev.shiftKey) // ctrl-shift-enter
            addNote($list, null, $note);
        else if ($note && !ev.shiftKey) // ctrl-enter
            addNote($list, $note);

        return false;
    }

    if (ev.keyCode === 13 && this.tagName === 'INPUT' ||
        ev.keyCode === 13 && ev.altKey ||
        ev.keyCode === 13 && ev.shiftKey) {
        stopEditing($(this), false);
        return false;
    }

    if (ev.key === '*' && ev.ctrlKey) {
        const have = this.value;
        const pos = this.selectionStart;
        const want = have.substr(0, pos) + '\u2022 ' + have.substr(this.selectionEnd);

        $(this).val(want);
        this.selectionStart = this.selectionEnd = pos + 2;
        return false;
    }

    return true;
});

$('.board .edit').live('keypress', function (ev) {
    // tab
    if (ev.keyCode === 9) {
        handleTab.call(this, ev);
        return false;
    }
});

$('.board .edit').live('blur', function (ev) {
    if (document.activeElement != this)
        stopEditing($(this));
    else
        ; // switch away from the browser window
});

$('.board .note .edit').live('input propertychange', function () {
    const delta = $(this).outerHeight() - $(this).height();

    $(this).height(10);

    if (this.scrollHeight > this.clientHeight)
        $(this).height(this.scrollHeight - delta);

});

$('.config .add-board').live('click', function () {
    addBoard();
    return false;
});

$('.config .load-board').live('click', function () {
    ws.send(JSON.stringify({
        command: 'GET_BOARD',
        data: {
            id: parseInt($(this).attr('target-board-id'))
        },
    }))

    return false;
});

$('.board .del-board').live('click', function () {
    const $list = $('.wrap .board .list');
    if ($list.length && !confirm("PERMANENTLY delete this board, all its lists and their notes?"))
        return;

    deleteBoard();
    return false;
});

$('.board .add-list').live('click', function () {
    addList();
    return false;
});

$('.board .del-list').live('click', function () {
    const $list = $(this).closest('.list');

    if (!confirm("Delete this list and all its notes?"))
        return;

    ws.send(JSON.stringify({
        'command': 'DELETE_LIST',
        'data': {
            id: parseInt($list.attr('list-id')),
        },
    }));

    deleteList($list);

    return false;
});

$('.board .mov-list-l').live('click', function () {
    ws.send(JSON.stringify({
        command: "MOVE_LIST",
        data: {
            id: parseInt($(this).closest('.list').attr('list-id')),
            board_id: parseInt($(this).closest('.board').attr('board-id')),
            direction: "LEFT",
        },
    }))

    moveList($(this).closest('.list'), true);
    return false;
});

$('.board .mov-list-r').live('click', function () {
    ws.send(JSON.stringify({
        command: "MOVE_LIST",
        data: {
            id: parseInt($(this).closest('.list').attr('list-id')),
            board_id: parseInt($(this).closest('.board').attr('board-id')),
            direction: "RIGHT",
        },
    }))

    moveList($(this).closest('.list'), false);
    return false;
});

$('.board .add-note').live('click', function () {
    addNote($(this).closest('.list'));
    return false;
});

$('.board .del-note').live('click', function () {
    const $note = $(this).closest('.note');

    ws.send(JSON.stringify({
        command: 'DELETE_NOTE',
        data: {
            id: parseInt($note.attr('note-id')),
        },
    }))

    deleteNote($note);

    return false;
});

$('.board .raw-note').live('click', function () {
    const $note = $(this).closest('.note');

    $note.toggleClass('raw');

    ws.send(JSON.stringify({
        command: 'EDIT_NOTE',
        data: {
            id: parseInt($note.attr('note-id')),
            raw: $note.hasClass('raw'),
        },
    }))

    return false;
});

$('.board .collapse').live('click', function () {
    const $note = $(this).closest('.note');

    $note.toggleClass('collapsed');

    ws.send(JSON.stringify({
        command: 'EDIT_NOTE',
        data: {
            id: parseInt($note.attr('note-id')),
            minimized: $note.hasClass('collapsed'),
        },
    }))

    return false;
});

$('.board .note .text').live('mousedown', function (ev) {
    drag.prime(this, ev);
});

$(document).on('mouseup', function () {
    drag.end();
});

$(document).on('mousemove', function (ev) {
    setRevealState(ev);
    drag.onMouseMove(ev);
});

$('.config .switch-theme').on('click', function () {
    const $body = $('body');
    $body.toggleClass('dark');
    localStorage.setItem('nullboard.theme', $body.hasClass('dark') ? 'dark' : '');
    return false;
});

$('.config .switch-fsize').on('click', function () {
    const $body = $('body');
    $body.toggleClass('z1');
    localStorage.setItem('nullboard.fsize', $body.hasClass('z1') ? 'z1' : '');
    return false;
});

function adjustLayout() {
    const $body = $('body');
    const $board = $('.board');

    if (!$board.length)
        return;

    const lists = $board.find('.list').length;
    const lists_w = (lists < 2) ? 250 : 260 * lists - 10;
    const body_w = $body.width();

    if (lists_w + 190 <= body_w) {
        $board.css('max-width', '');
        $body.removeClass('crowded');
    } else {
        let max = Math.floor((body_w - 40) / 260);
        max = (max < 2) ? 250 : 260 * max - 10;
        $board.css('max-width', max + 'px');
        $body.addClass('crowded');
    }
}

$(window).resize(adjustLayout);

adjustLayout();

function adjustListScroller() {
    const $board = $('.board');
    if (!$board.length)
        return;

    const $lists = $('.board .lists');
    const $scroller = $('.board .lists-scroller');
    const $inner = $scroller.find('div');

    const max = $board.width();
    const want = $lists[0].scrollWidth;
    const have = $inner.width();

    if (want <= max) {
        $scroller.hide();
        return;
    }

    $scroller.show();
    if (want === have)
        return;

    $inner.width(want);
    cloneScrollPos($lists, $scroller);
}

function cloneScrollPos($src, $dst) {
    const src = $src[0];
    const dst = $dst[0];

    if (src._busyScrolling) {
        src._busyScrolling--;
        return;
    }

    dst._busyScrolling++;
    dst.scrollLeft = src.scrollLeft;
}

function setupListScrolling() {
    const $lists = $('.board .lists');
    const $scroller = $('.board .lists-scroller');

    adjustListScroller();

    $lists[0]._busyScrolling = 0;
    $scroller[0]._busyScrolling = 0;

    $scroller.on('scroll', function () {
        cloneScrollPos($scroller, $lists);
    });

    $lists.on('scroll', function () {
        cloneScrollPos($lists, $scroller);
    });

    adjustLayout();
}

if (localStorage.getItem('nullboard.theme') === 'dark')
    $('body').addClass('dark');

if (localStorage.getItem('nullboard.fsize') === 'z1')
    $('body').addClass('z1');

setInterval(adjustListScroller, 100);

let ws = new WebSocket((document.location.protocol === 'https:' ? "wss://" : "ws://" ) + window.location.hostname + "/live");

// Keep-alive mechanism.
function keepAlive() {
    if (ws.readyState === ws.OPEN) {
        ws.send('');
    }

    setTimeout(keepAlive, 10000);
}

ws.onopen = function() {
    const board_id = localStorage.getItem('board_id');

    ws.send(JSON.stringify({
        command: "GET_BOARD_LIST"
    }));

    if (board_id > 0) {
        ws.send(JSON.stringify({
            command: 'GET_BOARD',
            data: {
                id: parseInt(board_id),
            },
        }));
    }

    keepAlive();
}

ws.onclose = function() {
    ws = null;
    location.reload();
}

ws.onmessage = function(evt) {
    const obj = JSON.parse(evt.data);

    if (obj.command === "BOARD_LIST") {
        document.boards = {};
        for (let i = 0; i < obj.data.length; i++) {
            const board = obj.data[i];
            document.boards[board.id] = {
                id: board.id,
                title: board.title,
            };
        }

        updateBoardMenu();
    }

    if (obj.command === "BOARD") {
        if (typeof obj.data.lists === "undefined") {
            obj.data.lists = [];
        }

        document.boards[obj.data.id] = obj.data;

        openBoard(obj.data.id);
    }

    if (obj.command === 'DELETE_BOARD') {
        const $board = $('[board-id=' + obj.data.id + ']');
        if ($board) {
            closeBoard();
        }
    }

    if (obj.command === "EDIT_NOTE") {
        const $note = $('[note-id=' + obj.data.id + ']');

        if (typeof obj.data.text !== "undefined") {
            const $text = $note.find('.text');
            setText($text, obj.data.text);
        }

        if (typeof obj.data.raw !== "undefined") {
            if (obj.data.raw) {
                $note.addClass('raw');
            } else {
                $note.removeClass('raw');
            }
        }

        if (typeof obj.data.minimized !== "undefined") {
            if (obj.data.minimized) {
                $note.addClass('collapsed');
            } else {
                $note.removeClass('collapsed');
            }
        }

        if (typeof obj.data.list_id !== "undefined") {
            $note.appendTo($('[list-id=' + obj.data.list_id + '] > .notes'));
        }

        if (typeof obj.data.previous_note_id !== "undefined" && obj.data.previous_note_id > 0) {
            $note.insertAfter($('[note-id=' + obj.data.previous_note_id + ']'));
        } else if (typeof obj.data.previous_note_id !== "undefined" && obj.data.previous_note_id === 0) {
            $('[list-id=' + obj.data.list_id + ']').find('.notes').prepend($note);
        }
    }

    if (obj.command === 'ADD_NOTE') {
        const $list = $('[list-id=' + obj.data.list_id + ']');
        let $note = $list.find('.note:not([note-id])');

        // Handle remotely create note.
        if ($note.length === 0) {
            $note = $('tt .note').clone();
            $list.find('.notes').append($note);

            const $last = $list.find('.note').last();

            setText($last.find('.text'), obj.data.text);
        }
        else if ($note.length === 1) {
            $note.attr('note-id', obj.data.id);
        }
        else if ($note.length > 1) {
            location.reload();
        }

        $note.attr('note-id', obj.data.id);
    }

    if (obj.command === 'DELETE_NOTE') {
        const $note = $('[note-id=' + obj.data.id + ']');
        deleteNote($note);
    }

    if (obj.command === "EDIT_LIST") {
        const $text = $('[list-id=' + obj.data.id + ']').find('.head .text');
        setText($text, obj.data.title);
    }

    if (obj.command === "EDIT_BOARD") {
        const $text = $('[board-id=' + obj.data.id + ']').find('.head .text').first();
        document.boards[obj.data.id].title = obj.data.title;
        setText($text, obj.data.title);
        updateBoardMenu();
    }

    if (obj.command === "DELETE_LIST") {
        const $list = $('[list-id=' + obj.data.id + ']');
        deleteList($list);
    }

    if (obj.command === "ADD_LIST") {
        const $board = $('.board[board-id=' + obj.data.board_id + ']');
        if ($board.length === 0) {
            return;
        }

        let $list = $board.find('.lists > .list:not([list-id])');

        if ($list.length === 0) {
            const $board = $('.wrap .board');
            const $lists = $board.find('.lists');
            $list = $('tt .list').clone();
            $list.attr('list-id', obj.data.id);

            $list.find('.text').html('');
            $lists.append($list);

            const lists = $lists[0];

            setText($list.find('.text'), obj.data.title);

            lists.scrollLeft = Math.max(0, lists.scrollWidth - lists.clientWidth);

            setupListScrolling();
        }
        else if ($list.length === 1) {
            $list.attr('list-id', obj.data.id);
        }
        else {
            location.reload();
        }
    }

    if (obj.command === "ADD_BOARD") {
        const $board = $('.board:not([board-id])').first();
        if ($board.length === 1) {
            $board.attr('board-id', obj.data.id);
        }
        localStorage.setItem('board_id', obj.data.id);
    }

    if (obj.command === "MOVE_LIST") {
        moveList($('[list-id=' + obj.data.id + ']'), obj.data.direction === 'LEFT');
    }
}

ws.onerror = function(evt) {
    ws = null;
    location.reload();
}