package storage

import (
	"fmt"
	"testing"
)

func TestMigration18_DropsScreenshotAndShellProjectColumns(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	for _, table := range []string{"screenshots", "shell_commands"} {
		rows, err := store.DB().Query(fmt.Sprintf(`PRAGMA table_info(%s)`, table))
		if err != nil {
			t.Fatal(err)
		}
		var cols []string
		for rows.Next() {
			var cid int
			var name, ctype string
			var notnull, pk int
			var dflt interface{}
			if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
				t.Fatal(err)
			}
			cols = append(cols, name)
			if name == "project_id" || name == "project_confidence" || name == "project_source" {
				t.Errorf("table %s still has dead column %q", table, name)
			}
		}
		rows.Close()
	}
}
