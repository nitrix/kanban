package main

import (
	"database/sql"
	"encoding/json"
	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"
	"io/ioutil"
	"log"
	"net/http"
	"sync"
)

var connections map[*websocket.Conn]bool
var connectionsMutex sync.Mutex
var database *sql.DB

func main() {
	var err error

	connections = make(map[*websocket.Conn]bool, 0)

	database, err = sql.Open("sqlite3", "kanban.db")
	if err != nil {
		log.Fatalln(err)
	}

	http.HandleFunc("/", indexPage)

	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	http.HandleFunc("/live", live)

	err = http.ListenAndServe(":80", nil)
	if err != nil {
		log.Fatalln(err)
	}
}

func live(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{}

	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade:", err)
		return
	}

	connectionsMutex.Lock()
	connections[c] = true
	connectionsMutex.Unlock()

	defer func() {
		connectionsMutex.Lock()
		delete(connections, c)
		connectionsMutex.Unlock()

		_ = c.Close()
	}()

	for {
		_, data, err := c.ReadMessage()
		if err != nil {
			log.Println("Unable to read from websocket:", err)
			return
		}

		message := Message{}
		err = json.Unmarshal(data, &message)
		if err != nil {
			log.Println("Unable to deserialize message from websocket:", err)
			return
		}

		err = processMessage(c, message)
		if err != nil {
			log.Println("Unable to process message:", err)
			return
		}
	}
}

func processMessage(connection *websocket.Conn, message Message) error {
	if message.Command == "GetBoards" {
		return sendBoards(connection)
	}

	return sendMessage(connection, Message{
		Command: "Error",
		Data: "Command not supported",
	})
}

func sendBoards(connection *websocket.Conn) error {
	rows, err := database.Query("SELECT `id`, `title` FROM boards")
	if err != nil {
		return err
	}

	boards := make([]Board, 0)
	for rows.Next() {
		board := Board{}

		err := rows.Scan(&board.ID, &board.Title)
		if err != nil {
			return err
		}

		board.Lists, err = getBoardLists(board.ID)

		boards = append(boards, board)
	}

	err = rows.Err()
	if err != nil {
		return err
	}

	return sendMessage(connection, Message{
		Command: "Boards",
		Data: boards,
	})
}

func getBoardLists(boardId int) ([]List, error) {
	lists := make([]List, 0)

	rows, err := database.Query("SELECT `id`, `title` FROM lists WHERE `board_id` = ?", boardId)
	if err != nil {
		return nil, err
	}

	for rows.Next() {
		list := List{}

		err = rows.Scan(&list.ID, &list.Title)
		if err != nil {
			return nil, err
		}

		list.Notes, err = getNotesInList(list.ID)
		if err != nil {
			return nil, err
		}

		lists = append(lists, list)
	}

	return lists, nil
}

func getNotesInList(listId int) ([]Note, error) {
	notes := make([]Note, 0)

	rows, err := database.Query("SELECT `id`, `minimized`, `raw`, `text` FROM notes WHERE `list_id` = ?", listId)
	if err != nil {
		return nil, err
	}

	for rows.Next() {
		note := Note{}

		err = rows.Scan(&note.ID, &note.Minimized, &note.Raw, &note.Text)
		if err != nil {
			return nil, err
		}

		notes = append(notes, note)
	}

	return notes, nil
}

func sendMessage(connection *websocket.Conn, message Message) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	err = connection.WriteMessage(websocket.TextMessage, data)
	if err != nil {
		return err
	}

	return nil
}

func broadcastMessage(message Message) {
	connectionsMutex.Lock()
	defer connectionsMutex.Unlock()

	for connection := range connections {
		_ = sendMessage(connection, message)
	}
}

func indexPage(w http.ResponseWriter, r *http.Request) {
	content, err := ioutil.ReadFile("index.html")
	if err != nil {
		http.Error(w, "Missing homepage", 404)
	}

	_, err = w.Write(content)
	if err != nil {
		http.Error(w, "Internal error while sending homepage", 500)
	}
}