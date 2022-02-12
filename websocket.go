package main

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/gorilla/websocket"
	"gorm.io/gorm"
)

func processMessage(connection *websocket.Conn, data []byte) error {
	message := Message{}

	if len(data) == 0 {
		return nil
	}

	err := json.Unmarshal(data, &message)
	if err != nil {
		return err
	}

	fmt.Println("Received:", message)

	switch message.Command {
	case CommandGetBoardList:
		return sendBoardList()
	case CommandMoveList:
		tmp := struct{ Data MessageMoveList }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return moveList(connection, tmp.Data)
	case CommandGetBoard:
		tmp := struct{ Data MessageGetBoard }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return sendBoard(connection, tmp.Data)
	case CommandDeleteBoard:
		tmp := struct{ Data MessageDeleteBoard }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return deleteBoard(tmp.Data)
	case CommandAddBoard:
		tmp := struct{ Data MessageAddBoard }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return addBoard(tmp.Data)
	case CommandAddNote:
		tmp := struct{ Data MessageAddNote }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return addNote(tmp.Data)
	case CommandDeleteNote:
		tmp := struct{ Data MessageDeleteNote }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return deleteNote(tmp.Data)
	case CommandAddList:
		tmp := struct{ Data MessageAddList }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return addList(tmp.Data)
	case CommandDeleteList:
		tmp := struct{ Data MessageDeleteList }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return deleteList(tmp.Data)
	case CommandEditNote:
		tmp := struct{ Data MessageEditNote }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return editNote(tmp.Data)
	case CommandEditBoard:
		tmp := struct{ Data MessageEditBoard }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return editBoard(tmp.Data)
	case CommandEditList:
		tmp := struct{ Data MessageEditList }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return editList(tmp.Data)
	default:
		return sendMessage(connection, Message{
			Command: "Error",
			Data:    "Command not supported",
		})
	}
}

func deleteBoard(data MessageDeleteBoard) error {
	board := Board{ID: data.Id}

	if err := db.Delete(board).Error; err != nil {
		return err
	}

	broadcastMessage(Message{
		Command: CommandDeleteBoard,
		Data:    data,
	}, nil)

	return sendBoardList()
}

func addBoard(data MessageAddBoard) error {

	board := Board{Title: data.Title}

	if err := db.Create(&board).Error; err != nil {
		return err
	}

	fmt.Println("Board created:", board.ID)
	data.Id = board.ID

	broadcastMessage(Message{
		Command: CommandAddBoard,
		Data:    data,
	}, nil)

	return sendBoardList()
}

func addNote(data MessageAddNote) error {
	maxOrder := uint(0)

	db.Select("MAX(\"order\")").Table("notes").Where("list_id = ?", data.ListId).Row().Scan(&maxOrder)

	note := Note{
		ListID: data.ListId,
		Text:   data.Text,
		Order:  maxOrder + 1,
	}

	if err := db.Create(&note).Error; err != nil {
		return err
	}

	data.Id = note.ID

	broadcastMessage(Message{
		Command: CommandAddNote,
		Data:    data,
	}, nil)

	return nil
}

func addList(data MessageAddList) error {
	maxOrder := uint(0)

	db.Select("MAX(\"order\")").Table("lists").Where("board_id = ?", data.BoardId).Row().Scan(&maxOrder)

	list := List{
		Title:   data.Title,
		BoardID: data.BoardId,
		Order:   maxOrder + 1,
	}

	if err := db.Create(&list).Error; err != nil {
		return err
	}

	data.Id = list.ID

	broadcastMessage(Message{
		Command: CommandAddList,
		Data:    data,
	}, nil)

	return nil
}

func deleteList(data MessageDeleteList) error {
	list := List{ID: data.Id}

	if err := db.Delete(list).Error; err != nil {
		return err
	}

	broadcastMessage(Message{
		Command: CommandDeleteList,
		Data:    data,
	}, nil)

	return nil
}

func deleteNote(data MessageDeleteNote) error {
	note := Note{ID: data.Id}

	if err := db.Delete(note).Error; err != nil {
		return err
	}

	broadcastMessage(Message{
		Command: CommandDeleteNote,
		Data:    data,
	}, nil)

	return nil
}

func moveList(connection *websocket.Conn, data MessageMoveList) error {
	board := Board{ID: data.BoardId}

	if err := db.Preload("Lists").Take(&board).Error; err != nil {
		return err
	}

	previousListIds := make([]uint64, 0)
	for _, list := range board.Lists {
		previousListIds = append(previousListIds, list.ID)
	}

	fmt.Println(previousListIds)

	finalListIds := make([]uint64, 0)

	for _, listId := range data.ListIds {
		fListId, err := strconv.ParseUint(listId, 10, 64)
		if err != nil {
			return err
		}

		found := false
		for _, previousListId := range previousListIds {
			if fListId == previousListId {
				found = true
				break
			}
		}

		if found {
			finalListIds = append(finalListIds, fListId)
		}
	}

	fmt.Println(finalListIds)

	for k, listId := range finalListIds {
		if err := db.Model(&List{ID: listId}).Update("order", k).Error; err != nil {
			return err
		}
	}

	broadcastMessage(Message{
		Command: CommandMoveList,
		Data:    data,
	}, connection)

	return nil
}

func editNote(data MessageEditNote) error {
	note := Note{ID: data.Id}

	if err := db.Take(&note).Error; err != nil {
		return err
	}

	// Text
	if data.Text != "" {
		note.Text = data.Text
	}

	// List id
	if data.ListId != 0 {
		note.ListID = data.ListId
	}

	// Minimized
	if data.Minimized != nil {
		note.Minimized = *data.Minimized
	}

	// Raw
	if data.Raw != nil {
		note.Raw = *data.Raw
	}

	// Moving
	newNoteIds := make([]uint64, 0)

	if data.PreviousNoteId != nil {
		notes := []Note{}

		if err := db.Where("list_id = ?", note.ListID).Find(&notes).Error; err != nil {
			return err
		}

		if *data.PreviousNoteId == "" || *data.PreviousNoteId == "0" {
			newNoteIds = append(newNoteIds, data.Id)
		}

		for _, note := range notes {
			if note.ID == data.Id {
				// Do nothing, it will be moved.
				continue
			}

			fPreviousNoteId, err := strconv.ParseUint(*data.PreviousNoteId, 10, 64)
			if err != nil {
				return err
			}

			if note.ID == fPreviousNoteId {
				newNoteIds = append(newNoteIds, note.ID)
				newNoteIds = append(newNoteIds, data.Id)
			} else {
				newNoteIds = append(newNoteIds, note.ID)
			}
		}
	}

	if err := db.Save(&note).Error; err != nil {
		return err
	}

	for k, noteId := range newNoteIds {
		if err := db.Model(&Note{ID: noteId}).Update("order", k).Error; err != nil {
			return err
		}
	}

	broadcastMessage(Message{
		Command: CommandEditNote,
		Data:    data,
	}, nil)

	return nil
}

func editBoard(data MessageEditBoard) error {
	board := Board{ID: data.Id}

	if err := db.Model(&board).Update("title", data.Title).Error; err != nil {
		return err
	}

	broadcastMessage(Message{
		Command: CommandEditBoard,
		Data:    data,
	}, nil)

	return nil
}

func editList(data MessageEditList) error {
	list := List{ID: data.Id}

	if err := db.Model(&list).Update("title", data.Title).Error; err != nil {
		return err
	}

	broadcastMessage(Message{
		Command: CommandEditList,
		Data:    data,
	}, nil)

	return nil
}

func sendBoardList() error {
	var boards []Board

	if err := db.Find(&boards).Error; err != nil {
		return err
	}

	broadcastMessage(Message{
		Command: CommandBoardList,
		Data:    boards,
	}, nil)

	return nil
}

func sendBoard(connection *websocket.Conn, data MessageGetBoard) error {
	board := Board{ID: data.Id}

	if err := db.Preload("Lists", func(q *gorm.DB) *gorm.DB {
		return q.Order("\"order\" ASC").Preload("Notes", func(z *gorm.DB) *gorm.DB {
			return z.Order("\"order\" ASC")
		})
	}).Take(&board).Error; err != nil {
		return err
	}

	return sendMessage(connection, Message{
		Command: CommandBoard,
		Data:    board,
	})
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

func broadcastMessage(message Message, exclude *websocket.Conn) {
	connectionsMutex.Lock()
	defer connectionsMutex.Unlock()

	for connection := range connections {
		if connection != exclude {
			_ = sendMessage(connection, message)
		}
	}
}
