package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gorilla/websocket"
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
		tmp := struct { Data MessageMoveList }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return moveList(connection, tmp.Data)
	case CommandGetBoard:
		tmp := struct { Data MessageGetBoard }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return sendBoard(connection, tmp.Data)
	case CommandDeleteBoard:
		tmp := struct { Data MessageDeleteBoard }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return deleteBoard(tmp.Data)
	case CommandAddBoard:
		tmp := struct { Data MessageAddBoard }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return addBoard(tmp.Data)
	case CommandAddNote:
		tmp := struct { Data MessageAddNote }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return addNote(tmp.Data)
	case CommandDeleteNote:
		tmp := struct { Data MessageDeleteNote }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return deleteNote(tmp.Data)
	case CommandAddList:
		tmp := struct { Data MessageAddList }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return addList(tmp.Data)
	case CommandDeleteList:
		tmp := struct { Data MessageDeleteList }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return deleteList(tmp.Data)
	case CommandEditNote:
		tmp := struct { Data MessageEditNote }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return editNote(tmp.Data)
	case CommandEditBoard:
		tmp := struct { Data MessageEditBoard }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return editBoard(tmp.Data)
	case CommandEditList:
		tmp := struct { Data MessageEditList }{}
		err := json.Unmarshal(data, &tmp)
		if err != nil {
			return err
		}
		return editList(tmp.Data)
	default:
		return sendMessage(connection, Message{
			Command: "Error",
			Data: "Command not supported",
		})
	}
}

func deleteBoard(data MessageDeleteBoard) error {
	result, err := database.Exec("DELETE FROM `boards` WHERE `id` = ?", data.Id)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if affected != 1 {
		return errors.New("unable to create new note")
	}

	broadcastMessage(Message{
		Command: CommandDeleteBoard,
		Data: data,
	}, nil)

	return sendBoardList()
}

func addBoard(data MessageAddBoard) error {
	result, err := database.Exec("INSERT INTO `boards` (`title`) VALUES(?)", data.Title)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if affected != 1 {
		return errors.New("unable to create new note")
	}

	lastInsertId, err := result.LastInsertId()
	if err != nil {
		return errors.New("unable to get last inserted board")
	}

	data.Id = int(lastInsertId)

	broadcastMessage(Message{
		Command: CommandAddBoard,
		Data: data,
	}, nil)

	return sendBoardList()
}

func addNote(data MessageAddNote) error {
	result, err := database.Exec("INSERT INTO `notes` (`text`, `list_id`) VALUES(?, ?)", data.Text, data.ListId)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if affected != 1 {
		return errors.New("unable to create new note")
	}

	lastInsertId, err := result.LastInsertId()
	if err != nil {
		return errors.New("unable to get last inserted note")
	}

	data.Id = int(lastInsertId)

	broadcastMessage(Message{
		Command: CommandAddNote,
		Data: data,
	}, nil)

	return nil
}

func addList(data MessageAddList) error {
	result, err := database.Exec("INSERT INTO `lists` (`board_id`, `title`) VALUES (?, ?)", data.BoardId, data.Title)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if affected != 1 {
		return errors.New("unable to add new list")
	}

	lastInsertId, err := result.LastInsertId()
	if err != nil {
		return errors.New("unable to get last inserted note")
	}

	data.Id = int(lastInsertId)

	broadcastMessage(Message{
		Command: CommandAddList,
		Data: data,
	}, nil)

	return nil
}

func deleteList(data MessageDeleteList) error {
	result, err := database.Exec("DELETE FROM `lists` WHERE `id` = ?", data.Id)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if affected != 1 {
		return errors.New("unable to delete list")
	}

	broadcastMessage(Message{
		Command: CommandDeleteList,
		Data: data,
	}, nil)

	return nil
}

func deleteNote(data MessageDeleteNote) error {
	result, err := database.Exec("DELETE FROM `notes` WHERE `id` = ?", data.Id)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if affected != 1 {
		return errors.New("unable to delete note")
	}

	broadcastMessage(Message{
		Command: CommandDeleteNote,
		Data: data,
	}, nil)

	return nil
}

func moveList(connection *websocket.Conn, data MessageMoveList) error {
	lists, err := getBoardLists(data.BoardId)
	if err != nil {
		return err
	}

	newListIds := make([]int, 0)
	for _, list := range lists {
		newListIds = append(newListIds, list.ID)
	}

	for k, id := range newListIds {
		if id == data.Id && data.Direction == "LEFT" && k > 0 {
			newListIds[k-1], newListIds[k] = newListIds[k], newListIds[k-1]
			break
		}

		if id == data.Id && data.Direction == "RIGHT" && k < len(newListIds) {
			newListIds[k], newListIds[k+1] = newListIds[k+1], newListIds[k]
			break
		}
	}

	for k, listId := range newListIds {
		_, err := database.Exec("UPDATE `lists` SET `order` = ? WHERE `id` = ?", len(newListIds) - k, listId)

		if err != nil {
			return err
		}
	}

	broadcastMessage(Message{
		Command: CommandMoveList,
		Data: data,
	}, connection)

	return nil
}

func editNote(data MessageEditNote) error {
	// Text
	if data.Text != "" {
		result, err := database.Exec("UPDATE `notes` SET `text` = ? WHERE `id` = ?", data.Text, data.Id)
		if err != nil {
			return err
		}

		affected, err := result.RowsAffected()
		if err != nil {
			return err
		}

		if affected != 1 {
			return errors.New("note not found")
		}
	}

	// List id
	if data.ListId > 0 {
		result, err := database.Exec("UPDATE `notes` SET `list_id` = ? WHERE `id` = ?", data.ListId, data.Id)
		if err != nil {
			return err
		}

		affected, err := result.RowsAffected()
		if err != nil {
			return err
		}

		if affected != 1 {
			return errors.New("note not found")
		}
	}

	// Minimized
	if data.Minimized != nil {
		result, err := database.Exec("UPDATE `notes` SET `minimized` = ? WHERE `id` = ?", *data.Minimized, data.Id)
		if err != nil {
			return err
		}

		affected, err := result.RowsAffected()
		if err != nil {
			return err
		}

		if affected != 1 {
			return errors.New("note not found")
		}
	}

	// Raw
	if data.Raw != nil {
		result, err := database.Exec("UPDATE `notes` SET `raw` = ? WHERE `id` = ?", *data.Raw, data.Id)
		if err != nil {
			return err
		}

		affected, err := result.RowsAffected()
		if err != nil {
			return err
		}

		if affected != 1 {
			return errors.New("note not found")
		}
	}

	if data.PreviousNoteId != nil {
		notes, err := getNotesInList(data.ListId)
		if err != nil {
			return err
		}

		newNoteIds := make([]int, 0)

		if *data.PreviousNoteId == 0 {
			newNoteIds = append(newNoteIds, data.Id)
		}

		for _, note := range notes {
			if note.ID == data.Id {
				// Do nothing, it was already moved.
				continue
			}

			if note.ID == *data.PreviousNoteId {
				newNoteIds = append(newNoteIds, note.ID)
				newNoteIds = append(newNoteIds, data.Id)
			} else {
				newNoteIds = append(newNoteIds, note.ID)
			}
		}

		fmt.Println(newNoteIds)

		for k, noteId := range newNoteIds {
			_, err := database.Exec("UPDATE `notes` SET `order` = ? WHERE `id` = ?", len(newNoteIds) - k, noteId)

			if err != nil {
				return err
			}
		}
	}

	broadcastMessage(Message{
		Command: CommandEditNote,
		Data: data,
	}, nil)

	return nil
}

func editBoard(data MessageEditBoard) error {
	result, err := database.Exec("UPDATE `boards` SET `title` = ? WHERE `id` = ?", data.Title, data.Id)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if affected != 1 {
		return errors.New("board not found")
	}

	broadcastMessage(Message{
		Command: CommandEditBoard,
		Data: data,
	}, nil)

	return nil
}

func editList(data MessageEditList) error {
	result, err := database.Exec("UPDATE `lists` SET `title` = ? WHERE `id` = ?", data.Title, data.Id)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if affected != 1 {
		return errors.New("list not found")
	}

	broadcastMessage(Message{
		Command: CommandEditList,
		Data: data,
	}, nil)

	return nil
}

func sendBoardList() error {
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

		boards = append(boards, board)
	}

	err = rows.Err()
	if err != nil {
		return err
	}

	broadcastMessage(Message{
		Command: CommandBoardList,
		Data: boards,
	}, nil)

	return nil
}

func sendBoard(connection *websocket.Conn, data MessageGetBoard) error {
	rows, err := database.Query("SELECT `id`, `title` FROM boards WHERE `id` = ?", data.Id)
	if err != nil {
		return err
	}

	board := Board{}

	for rows.Next() {
		err := rows.Scan(&board.ID, &board.Title)
		if err != nil {
			return err
		}

		lists, err := getBoardLists(board.ID)
		if err != nil {
			return err
		}

		board.Lists = lists
	}

	err = rows.Err()
	if err != nil {
		return err
	}

	if board.ID == 0 {
		return nil
	}

	return sendMessage(connection, Message{
		Command: CommandBoard,
		Data: board,
	})
}

func getBoardLists(boardId int) ([]List, error) {
	lists := make([]List, 0)

	rows, err := database.Query("SELECT `id`, `title` FROM lists WHERE `board_id` = ? ORDER BY `order` DESC", boardId)
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

	rows, err := database.Query("SELECT `id`, `minimized`, `raw`, `text`, `order` FROM notes WHERE `list_id` = ? ORDER BY `order` DESC, `id` ASC", listId)
	if err != nil {
		return nil, err
	}

	for rows.Next() {
		note := Note{}

		err = rows.Scan(&note.ID, &note.Minimized, &note.Raw, &note.Text, &note.order)
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

func broadcastMessage(message Message, exclude *websocket.Conn) {
	connectionsMutex.Lock()
	defer connectionsMutex.Unlock()

	for connection := range connections {
		if connection != exclude {
			_ = sendMessage(connection, message)
		}
	}
}