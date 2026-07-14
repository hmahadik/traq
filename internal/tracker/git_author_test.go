package tracker

import "testing"

func TestGitTrackerAuthorFilter(t *testing.T) {
	tr := &GitTracker{selfEmails: map[string]bool{}}

	// Empty allowlist => no filtering, every author qualifies.
	if !tr.isSelfAuthored("anyone@example.com") {
		t.Fatal("empty allowlist should treat every commit as self-authored")
	}

	tr.SetAuthorEmails([]string{
		"harshad@arcturusnetworks.com",
		"37708331+hmahadik@users.noreply.github.com",
		"hash0217@gmail.com",
	})

	cases := []struct {
		email string
		want  bool
	}{
		{"harshad@arcturusnetworks.com", true},
		{"HARSHAD@Arcturusnetworks.com", true}, // case-insensitive
		{"  hash0217@gmail.com  ", true},       // trimmed
		{"37708331+hmahadik@users.noreply.github.com", true},
		{"57334015+LiamMcArdle@users.noreply.github.com", false}, // teammate
		{"sachin.gill@gmail.com", false},                         // teammate
		{"", false},
	}
	for _, c := range cases {
		if got := tr.isSelfAuthored(c.email); got != c.want {
			t.Errorf("isSelfAuthored(%q) = %v, want %v", c.email, got, c.want)
		}
	}
}

func TestGitTrackerSetAuthorEmailsResetClearsFilter(t *testing.T) {
	tr := &GitTracker{selfEmails: map[string]bool{}}
	tr.SetAuthorEmails([]string{"me@example.com"})
	if tr.isSelfAuthored("other@example.com") {
		t.Fatal("configured allowlist should reject non-members")
	}
	// Passing empty (and blank/whitespace) entries clears the filter.
	tr.SetAuthorEmails([]string{"", "   "})
	if !tr.isSelfAuthored("other@example.com") {
		t.Fatal("clearing the allowlist should restore no-filter behavior")
	}
}
