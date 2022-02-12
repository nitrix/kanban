package main

type Command string

const (
	CommandGetBoardList Command = "GET_BOARD_LIST"
	CommandGetBoard     Command = "GET_BOARD"
	CommandBoard        Command = "BOARD"
	CommandBoardList    Command = "BOARD_LIST"
	CommandAddNote      Command = "ADD_NOTE"
	CommandDeleteNote   Command = "DELETE_NOTE"
	CommandEditNote     Command = "EDIT_NOTE"
	CommandEditList     Command = "EDIT_LIST"
	CommandEditBoard    Command = "EDIT_BOARD"
	CommandAddList      Command = "ADD_LIST"
	CommandDeleteList   Command = "DELETE_LIST"
	CommandAddBoard     Command = "ADD_BOARD"
	CommandDeleteBoard  Command = "DELETE_BOARD"
	CommandMoveList     Command = "MOVE_LIST"
)

type Message struct {
	Command Command     `json:"command"`
	Data    interface{} `json:"data"`
}

type MessageMoveList struct {
	Id        uint64   `json:"id,string"`
	BoardId   uint64   `json:"board_id,string"`
	Direction string   `json:"direction"`
	ListIds   []string `json:"list_ids"`
}

type MessageGetBoard struct {
	Id uint64 `json:"id,string"`
}

type MessageDeleteBoard struct {
	Id uint64 `json:"id,string"`
}

type MessageAddBoard struct {
	Id    uint64 `json:"id,string,omitempty"`
	Title string `json:"title"`
}

type MessageAddList struct {
	Id      uint64 `json:"id,string,omitempty"`
	Title   string `json:"title"`
	BoardId uint64 `json:"board_id,string"`
}

type MessageDeleteList struct {
	Id uint64 `json:"id,string"`
}

type MessageAddNote struct {
	Id     uint64 `json:"id,string,omitempty"`
	Uuid   string `json:"uuid"`
	Text   string `json:"text"`
	ListId uint64 `json:"list_id,string"`
}

type MessageDeleteNote struct {
	Id uint64 `json:"id,string"`
}

type MessageEditNote struct {
	Id             uint64  `json:"id,string"`
	ListId         uint64  `json:"list_id,string,omitempty"`
	Text           string  `json:"text,omitempty"`
	Raw            *bool   `json:"raw,omitempty"`
	Minimized      *bool   `json:"minimized,omitempty"`
	PreviousNoteId *string `json:"previous_note_id,omitempty"`
}

type MessageEditList struct {
	Id    uint64 `json:"id,string"`
	Title string `json:"title"`
}

type MessageEditBoard struct {
	Id    uint64 `json:"id,string"`
	Title string `json:"title"`
}
