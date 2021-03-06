package gastown3.nwhacks2019;

import android.content.Intent;
import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ListView;

import java.util.ArrayList;
import java.util.List;

import gastown3.nwhacks2019.server.Server;

public class SwipeUpActivity extends AppCompatActivity {

    private Button refresh;
    private ListView list;
    private EditText editText;

    private ArrayAdapter<String> stringAdapter;
    private ArrayList<String> stringList;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_swipe_up);

        setupStringList();

        stringAdapter = new ArrayAdapter<String>(getApplicationContext(), android.R.layout.simple_list_item_1, stringList);

        list = (ListView) findViewById(R.id.list_view);
        list.setAdapter(stringAdapter);

        list.setOnItemClickListener(new AdapterView.OnItemClickListener() {

            @Override
            public void onItemClick(AdapterView<?> parent, final View view,
                                    final int position, long id) {
                final String item = (String) parent.getItemAtPosition(position);
                System.out.println("POSITION IS " + position);
                view.animate().setDuration(600).alpha(0)
                        .withEndAction(new Runnable() {
                            @Override
                            public void run() {

                                //button press functionality
                                Intent intent = new Intent(SwipeUpActivity.this, FurtherInfoActivity.class);
                                intent.putExtra("POSITION", position);
                                finish();
                                startActivity(intent);
                                view.setAlpha(1);
                            }
                        });


            }

        });


        refresh = (Button) findViewById(R.id.renew_button);
        refresh.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                attemptRefresh();
            }
        });

    }

    //setup String
    private void setupStringList(){
        stringList = new ArrayList<>();

        Server mServer = new Server("http://5bcb1df1.ngrok.io/API/");
        RideEvent[] array = mServer.getRequests();

        for(RideEvent r: array){
            stringList.add(r.prettyPrint());
        }

    }


    //Refreshes the list of rideEvents
    private void attemptRefresh(){

        // check if adapter has changed
        stringAdapter.notifyDataSetChanged();

    }


    //return to maps
    @Override
    public void onBackPressed(){
        super.onBackPressed();
        this.finish();
        Intent intent = new Intent(SwipeUpActivity.this, MapsActivity2.class);
        startActivity(intent);
    }

    public void addRoutes(View view) {
        this.finish();
        Intent intent = new Intent(SwipeUpActivity.this, MapsActivity2.class);
        startActivity(intent);
    }
}
