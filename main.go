package main

import (
	"crypto/subtle"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	tokenGenerator "github.com/sethvargo/go-password/password"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var connections map[*websocket.Conn]bool
var connectionsMutex sync.Mutex
var db *gorm.DB

func main() {
	var err error

	connections = make(map[*websocket.Conn]bool)

	_ = os.Mkdir("data", 0700)

	postgresEnabled := os.Getenv("POSTGRES_ENABLED")
	postgresHostname := os.Getenv("POSTGRES_HOSTNAME")
	postgresDatabase := os.Getenv("POSTGRES_DATABASE")
	postgresUsername := os.Getenv("POSTGRES_USERNAME")
	postgresPort := os.Getenv("POSTGRES_PORT")
	postgresCertPath := os.Getenv("POSTGRES_CERT_PATH")
	postgresKeyPath := os.Getenv("POSTGRES_KEY_PATH")
	postgresCaPath := os.Getenv("POSTGRES_CA_PATH")

	if postgresHostname == "" {
		postgresHostname = "localhost"
	}

	if postgresPort == "" {
		postgresPort = "5432"
	}

	if postgresDatabase == "" {
		postgresDatabase = "kanban"
	}

	if postgresUsername == "" {
		postgresUsername = "kanban"
	}

	if postgresCertPath == "" {
		postgresCertPath = "certs/kanban.crt"
	}

	if postgresKeyPath == "" {
		postgresKeyPath = "certs/kanban.key"
	}

	if postgresCaPath == "" {
		postgresCaPath = "certs/ca.crt"
	}

	if postgresEnabled == "true" {
		connUrl := fmt.Sprintf("postgresql://%s@%s:%s/%s", postgresUsername, postgresHostname, postgresPort, postgresDatabase)
		connUrl += fmt.Sprintf("?sslmode=verify-full&sslcert=%s&sslkey=%s&sslrootcert=%s", postgresCertPath, postgresKeyPath, postgresCaPath)

		db, err = gorm.Open(postgres.Open(connUrl), nil)
		if err != nil {
			log.Fatalln("Unable to connect to Postgres database:", err)
		}
	} else {
		db, err = gorm.Open(sqlite.Open("data/kanban.db"), &gorm.Config{
			DisableForeignKeyConstraintWhenMigrating: true,
		})
		if err != nil {
			log.Fatalln("Unable to connect to Sqlite database:", err)
		}
	}

	err = db.AutoMigrate(&Board{}, &List{}, &Note{})
	if err != nil {
		log.Fatalln("Unable to migrate database:", err)
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

func fileExists(filename string) bool {
	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return false
	}

	return !info.IsDir()
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
			// log.Println("Unable to read from websocket:", err)
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
	if username == "" || password == "" {
		return handler
	}

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
