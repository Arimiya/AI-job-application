(function () {
  const isConfigured = () => {
    const config = window.CAREERAI_SUPABASE_CONFIG;
    return Boolean(
      config &&
        config.url &&
        config.publishableKey &&
        !config.url.includes("YOUR_PROJECT_ID") &&
        !config.publishableKey.includes("YOUR_SUPABASE")
    );
  };

  const toAppState = ({ profile, resumes, coverLetters, jobs, atsResult }) => ({
      user: {
        fullName: profile?.full_name || "John Carter",
        targetRole: profile?.target_role || "Software Engineer",
        emailAlerts: profile?.email_alerts || "daily",
        planStatus: profile?.plan_status || (profile?.plan_paused ? "paused" : "free")
      },
    resumes: resumes.map((resume) => ({
      id: resume.id,
      title: resume.title,
      role: resume.role,
      skills: resume.skills || [],
      score: resume.score,
      updatedAt: new Date(resume.updated_at).getTime()
    })),
    coverLetters: coverLetters.map((letter) => ({
      id: letter.id,
      company: letter.company,
      role: letter.role,
      highlight: letter.highlight,
      createdAt: new Date(letter.created_at).getTime()
    })),
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      match: job.match,
      saved: job.saved,
      skills: job.skills || []
    })),
    ats: {
      score: atsResult?.score || 85,
      insights: atsResult?.insights || [
        "Add more role-specific keywords from the job description.",
        "Keep bullets measurable with outcomes and numbers.",
        "Use simple section headings so parsing tools can read the resume."
      ]
    }
  });

  function remoteId(id, userId) {
    return /^(resume|cover|job)-/.test(id) ? `${userId}-${id}` : id;
  }

  function toRows(state, userId) {
    return {
      profile: {
        id: userId,
        full_name: state.user.fullName,
        target_role: state.user.targetRole,
        email_alerts: state.user.emailAlerts,
        plan_status: state.user.planStatus || "free",
        plan_paused: state.user.planStatus === "paused"
      },
      resumes: state.resumes.map((resume) => ({
        id: remoteId(resume.id, userId),
        user_id: userId,
        title: resume.title,
        role: resume.role,
        skills: resume.skills,
        score: resume.score,
        updated_at: new Date(resume.updatedAt).toISOString()
      })),
      coverLetters: state.coverLetters.map((letter) => ({
        id: remoteId(letter.id, userId),
        user_id: userId,
        company: letter.company,
        role: letter.role,
        highlight: letter.highlight,
        created_at: new Date(letter.createdAt).toISOString()
      })),
      jobs: state.jobs.map((job) => ({
        id: remoteId(job.id, userId),
        user_id: userId,
        title: job.title,
        company: job.company,
        location: job.location,
        match: job.match,
        saved: job.saved,
        skills: job.skills
      })),
      atsResult: {
        user_id: userId,
        score: state.ats.score,
        insights: state.ats.insights
      }
    };
  }

  async function assertOk(result) {
    if (result.error) throw result.error;
    return result.data;
  }

  async function createCareerAISupabase() {
    if (!isConfigured() || !window.supabase?.createClient) {
      return null;
    }

    const config = window.CAREERAI_SUPABASE_CONFIG;
    const client = window.supabase.createClient(config.url, config.publishableKey);

    async function getUser() {
      const sessionResult = await client.auth.getSession();
      return sessionResult.data.session?.user || null;
    }

    async function getUserId(options = {}) {
      let user = await getUser();

      if (!user && options.createAnonymous) {
        const signInResult = await client.auth.signInAnonymously();
        if (signInResult.error) throw signInResult.error;
        user = signInResult.data.user;
      }

      return user?.id || null;
    }

    async function fetchState(defaultState, options = {}) {
      const userId = await getUserId({ createAnonymous: options.createAnonymous === true });
      if (!userId) return defaultState;

      await assertOk(
        await client.from("profiles").upsert({
          id: userId,
          full_name: defaultState.user.fullName,
          target_role: defaultState.user.targetRole,
          email_alerts: defaultState.user.emailAlerts,
          plan_status: defaultState.user.planStatus || "free",
          plan_paused: defaultState.user.planStatus === "paused"
        })
      );

      const [profile, resumes, coverLetters, jobs, atsResults] = await Promise.all([
        assertOk(await client.from("profiles").select("*").eq("id", userId).single()),
        assertOk(await client.from("resumes").select("*").order("updated_at", { ascending: false })),
        assertOk(await client.from("cover_letters").select("*").order("created_at", { ascending: false })),
        assertOk(await client.from("jobs").select("*").order("created_at", { ascending: false })),
        assertOk(await client.from("ats_results").select("*").order("created_at", { ascending: false }).limit(1))
      ]);

      if (!resumes.length && !coverLetters.length && !jobs.length) {
        await saveState(defaultState);
        return defaultState;
      }

      return toAppState({
        profile,
        resumes,
        coverLetters,
        jobs,
        atsResult: atsResults[0]
      });
    }

    async function saveState(state) {
      const userId = await getUserId({ createAnonymous: true });
      const rows = toRows(state, userId);

      await assertOk(await client.from("profiles").upsert(rows.profile));
      if (rows.resumes.length) {
        await assertOk(await client.from("resumes").upsert(rows.resumes));
      }
      if (rows.coverLetters.length) {
        await assertOk(await client.from("cover_letters").upsert(rows.coverLetters));
      }
      if (rows.jobs.length) {
        await assertOk(await client.from("jobs").upsert(rows.jobs));
      }
      await assertOk(await client.from("ats_results").upsert(rows.atsResult, { onConflict: "user_id" }));
    }

    async function deleteRow(table, id) {
      await getUserId({ createAnonymous: true });
      await assertOk(await client.from(table).delete().eq("id", id));
    }

    async function signOut() {
      await client.auth.signOut();
    }

    async function hasSession() {
      return Boolean(await getUser());
    }

    async function signUpWithEmail({ fullName, email, password }) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });
      if (error) throw error;

      const user = data.session?.user || (await getUser());
      if (user) {
        await assertOk(
          await client.from("profiles").upsert({
            id: user.id,
            full_name: fullName,
            target_role: "Software Engineer",
            email_alerts: "daily",
            plan_status: "free",
            plan_paused: false
          })
        );
      }

      return data;
    }

    async function signInWithEmail({ email, password }) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    }

    async function signInWithGoogle() {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + window.location.pathname
        }
      });
      if (error) throw error;
      return data;
    }

    async function resetPassword(email) {
      const { data, error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });
      if (error) throw error;
      return data;
    }

    return {
      fetchState,
      saveState,
      deleteRow,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      resetPassword,
      hasSession,
      signOut,
      isConnected: true
    };
  }

  window.CareerAISupabase = {
    create: createCareerAISupabase
  };
})();
