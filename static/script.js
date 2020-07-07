const nb_dataVersion = 20190412;

document.boards = [];

window.onerror = function (message, file, line, col, e) {
    alert("Error occurred: " + e.message);
    return false;
};

window.addEventListener("error", function (e) {
    alert("Error occurred: " + e.error.message);
    return false;
})

function Note(text) {
    this.text = text;
    this.raw = false;
    this.min = false;
}

function Board(title) {
    this.id = +new Date();
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
}

function getText($note) {
    return $note.attr('_text');
}

function updatePageTitle() {
    if (!document.board) {
        document.title = 'Nullboard';
        return;
    }

    const $text = $('.wrap .board > .head .text');
    const title = getText($text);

    document.board.title = title;
    document.title = 'NB - ' + (title || '(unnamed board)');
}

function showBoard(quick) {
    const board = document.board;

    // Keep track of the last seen board.
    localStorage.setItem('board_id', board.id);

    const $wrap = $('.wrap');
    const $bdiv = $('tt .board');
    const $ldiv = $('tt .list');
    const $ndiv = $('tt .note');

    const $b = $bdiv.clone();
    const $b_lists = $b.find('.lists');

    $b[0].board_id = board.id;
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

    if ($item.attr('note-id')) {
        ws.send(JSON.stringify({
            'command': 'EDIT_NOTE',
            'data': {
                Id: parseInt($item.attr('note-id')),
                Text: text_now,
            },
        }));
    }

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
        updatePageTitle();
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

    if (!empty && !confirm("Delete this list and all its notes?"))
        return;

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
    const $list = $('.wrap .board .list');

    if ($list.length && !confirm("PERMANENTLY delete this board, all its lists and their notes?"))
        return;

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

        $have.animate({height: 0}, 'fast', function () {
            $have.remove();
            $want.css({marginTop: 5});
        });

        $want.css({display: 'block', height: 0, marginTop: 0});
        $want.animate({height: h}, 'fast', function () {
            $want.css({opacity: '', height: ''});
            drag.in_swap = false;
            drag.adjustDrag();
        });
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

        this.item = null;
    }
}

function updateBoardMenu() {
    const $index = $('.config .boards');
    const $entry = $('tt .load-board');

    const id_now = document.board && document.board.id;

    const board_id = localStorage.getItem('board_id');
    if (board_id === id_now)
        $e.addClass('active');

    let empty = true;

    $index.html('');
    $index.hide();

    for (const key in document.boards) {
        const $e = $entry.clone();
        $e[0].board_id = document.boards[key].id;
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
    closeBoard();
    openBoard($(this)[0].board_id);

    return false;
});

$('.board .del-board').live('click', function () {
    deleteBoard();
    return false;
});

$('.board .add-list').live('click', function () {
    addList();
    return false;
});

$('.board .del-list').live('click', function () {
    deleteList($(this).closest('.list'));
    return false;
});

$('.board .mov-list-l').live('click', function () {
    moveList($(this).closest('.list'), true);
    return false;
});

$('.board .mov-list-r').live('click', function () {
    moveList($(this).closest('.list'), false);
    return false;
});

$('.board .add-note').live('click', function () {
    addNote($(this).closest('.list'));
    return false;
});

$('.board .del-note').live('click', function () {
    deleteNote($(this).closest('.note'));
    return false;
});

$('.board .raw-note').live('click', function () {
    $(this).closest('.note').toggleClass('raw');
    return false;
});

$('.board .collapse').live('click', function () {
    $(this).closest('.note').toggleClass('collapsed');
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

let ws = new WebSocket("ws://localhost/live");

ws.onopen = function() {
    ws.send(JSON.stringify({
        command: "GET_BOARDS"
    }));
}

ws.onclose = function() {
    ws = null;
    alert('Lost connection');
    location.reload();
}

ws.onmessage = function(evt) {
    const obj = JSON.parse(evt.data);
    let board_id = localStorage.getItem('board_id');

    if (obj.command === "BOARDS") {
        for (let i = 0; i < obj.data.length; i++) {
            const board = obj.data[i];
            document.boards[board.id] = board;
        }

        updateBoardMenu();

        if (board_id === null && document.boards.length > 0) {
            board_id = document.boards[Object.keys(document.boards)[0]].id;
            localStorage.setItem('board_id', board_id);
        }

        if (board_id && typeof document.boards[board_id] !== "undefined") {
            document.board = document.boards[board_id];
            showBoard(true);
        }
    }

    if (obj.command === "EDIT_NOTE") {
        const $text = $('[note-id=' + obj.data.id + ']').find('.text');;
        setText($text, obj.data.text);
    }
}

ws.onerror = function(evt) {
    ws = null;
    alert("Communication error: " + evt.data);
    location.reload();
}