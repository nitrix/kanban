package main

import (
	"database/sql"
	_ "github.com/mattn/go-sqlite3"
	"io/ioutil"
	"os"
	"path/filepath"
)

func createDatabaseFromSchemaIfNecessary() error {
	_, err := os.Stat(filepath.Join("data", "kanban.db"))

	if os.IsNotExist(err) {
		schemaFile, err := os.Open("schema.sql")
		if err != nil {
			return err
		}

		schema, err := ioutil.ReadAll(schemaFile)
		if err != nil {
			return err
		}

		database, err = sql.Open("sqlite3", "data/kanban.db")
		if err != nil {
			return err
		}

		_, err = database.Exec(string(schema))
		if err != nil {
			return err
		}

		err = database.Close()
		if err != nil {
			return err
		}
	}

	return nil
}