package main

import (
	"crypto/subtle"
	"database/sql"
	"github.com/gorilla/websocket"
	tokenGenerator "github.com/sethvargo/go-password/password"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

var connections map[*websocket.Conn]bool
var connectionsMutex sync.Mutex
var database *sql.DB

func main() {
	var err error

	connections = make(map[*websocket.Conn]bool, 0)

	_ = os.Mkdir("data", 0700)

	err = createDatabaseFromSchemaIfNecessary()
	if err != nil {
		log.Fatalln(err)
	}

	database, err = sql.Open("sqlite3", "data/kanban.db?_foreign_keys=on")
	if err != nil {
		log.Fatalln(err)
	}

	username := os.Getenv("USERNAME")
	password := os.Getenv("PASSWORD")

	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	http.HandleFunc("/", authenticationHandler(indexPage, username, password, "Authentication required"))
	http.HandleFunc("/live", authenticationHandler(live, username, password, "Authentication required"))

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

		err = processMessage(c, data)
		if err != nil {
			log.Println("Unable to process message:", err)
			return
		}
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

func authenticationHandler(handler http.HandlerFunc, username, password, realm string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		trustCookie, err := r.Cookie("trust")
		if err == nil {
			if isTrusted(trustCookie.Value) {
				handler(w, r)
				return
			}
		}

		user, pass, ok := r.BasicAuth()

		if !ok || subtle.ConstantTimeCompare([]byte(user), []byte(username)) != 1 || subtle.ConstantTimeCompare([]byte(pass), []byte(password)) != 1 {
			w.Header().Set("WWW-Authenticate", `Basic realm="`+realm+`"`)
			w.WriteHeader(401)
			w.Write([]byte("Unauthorised.\n"))
			return
		}

		// Set trust cookie.
		token, err := tokenGenerator.Generate(64, 10, 0, false, true)
		if err == nil {
			trust(token)
			cookie := &http.Cookie{
				Name:    "trust",
				Value:   token,
				Expires: time.Now().Add(30 * 24 * time.Hour),
			}
			http.SetCookie(w, cookie)
		}

		handler(w, r)
	}
}
