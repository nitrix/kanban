package main

type Command string
const (
	CommandGetBoards Command = "GET_BOARDS"
	CommandBoards Command = "BOARDS"
	CommandEditNote Command = "EDIT_NOTE"
)

type Message struct {
	Command Command `json:"command"`
	Data interface{} `json:"data"`
}

type MessageEditNote struct {
	Id int `json:"id"`
	Text string `json:"text"`
}