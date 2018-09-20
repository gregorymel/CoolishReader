// Require the use of IOTA library
const iota = new IOTA({ provider: 'https://nodes.iota.fm:443' })

const tryteAlphabet = '9ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function rtrim(char, str) {
    if (str.slice(str.length - char.length) === char) {
      return rtrim(char, str.slice(0, 0 - char.length));
    } else {
      return str;
    }
}

function get_rating(book_addr, callback) {

    iota.api.findTransactionObjects( { addresses: [book_addr]}, function(error,success) { 
        if(error) { 
            console.log(error);
            return; 
        }
        //console.log(success)

        var rating = {
            "5" : 0,
            "4" : 0,
            "3" : 0,
            "2" : 0,
            "1" : 0,
            "total" : success.length,
            "avg" : 0
        };

        tmp = ''
        var sum = 0;
        for (var x = 0; x < success.length; x++) {
            tmp = success[x].signatureMessageFragment;

            tmp = rtrim('9', tmp);
            var res = iota.utils.fromTrytes(tmp);
            console.log(res);

            res = JSON.parse(res);
            rating[res["rating"]] += 1;
            sum += parseInt(res["rating"]);
            console.log(sum)
        }

        var avg = sum / success.length;
        rating["avg"] = avg;

        callback(rating);
    });
}

function push_rating(book_addr, rating) {
    const message = iota.utils.toTrytes(rating)

    console.log(rating);

    const transfers = [
        {
          value: 0,
          address: book_addr,
          message: message//,tag: tag
        }
      ]
      
      iota.api.sendTransfer(book_addr, 3, 14, transfers, (error, success) => {
        if (error) {
          console.log(error)
        } else {
          console.log(success)
        }
      })
}

function hashCreate(str)
{ 
    str = sha256(str);
    str = str.toUpperCase();
    //console.log(str);

    for(var i=0 ; i<65 ; i++)
    {
        if(str[i] == '0')
            str = str.substr(0,i) + 'G' + str.substr(i+1);
        if(str[i] == '1')
            str = str.substr(0,i) + 'H' + str.substr(i+1);
        if(str[i] == '2')
            str = str.substr(0,i) + 'I' + str.substr(i+1);
        if(str[i] == '3')
            str = str.substr(0,i) + 'J' + str.substr(i+1);
        if(str[i] == '4')
            str = str.substr(0,i) + 'K' + str.substr(i+1);
        if(str[i] == '5')
            str = str.substr(0,i) + 'L' + str.substr(i+1);
        if(str[i] == '6')
            str = str.substr(0,i) + 'M' + str.substr(i+1);
        if(str[i] == '7')
            str = str.substr(0,i) + 'N' + str.substr(i+1);
        if(str[i] == '8')
            str = str.substr(0,i) + 'O' + str.substr(i+1);

    }

    str= str + '99999999999999999';
    return str;
};